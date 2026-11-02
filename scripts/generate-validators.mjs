/**
 * Precompile the DP-1 JSON schemas into standalone JavaScript validators.
 *
 * Ajv normally compiles schemas with `new Function(...)` on first use, which throws
 * `Code generation from strings disallowed for this context` on runtimes that forbid
 * dynamic codegen — Cloudflare Workers / workerd being the one this package is tested on.
 * Compiling ahead of time keeps `src/schema/*.json` the single source of truth while
 * shipping plain functions that need no codegen.
 *
 * Output: `src/validate/generated/validators.js` + `validators.d.ts` (build artifacts).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { _ } from 'ajv';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const schemaDir = join(repoRoot, 'src/schema');
const outDir = join(repoRoot, 'src/validate/generated');

function readSchema(relativePath) {
  return JSON.parse(readFileSync(join(schemaDir, relativePath), 'utf8'));
}

const playlist = readSchema('core/playlist.json');
const playlistGroup = readSchema('core/playlist-group.json');
const refManifest = readSchema('core/ref-manifest.json');
const channel = readSchema('extensions/channels/schema.json');
const playlistsExt = readSchema('extensions/playlists/schema.json');
const playlistBundle = readSchema('extensions/playlists/bundles/playlist-core-v1.1.0.json');
const playlistWithExt = readSchema('extensions/playlists/playlist_with_extension.json');
const playlistItemWithExt = readSchema('extensions/playlists/playlist_item_with_extension.json');
const contentRatingExt = readSchema('extensions/content-rating/schema.json');
const playlistWithCrExt = readSchema('extensions/content-rating/playlist_with_extension.json');
const playlistItemWithCrExt = readSchema(
  'extensions/content-rating/playlist_item_with_extension.json'
);
const playlistWithPlaylistsAndCrExt = readSchema(
  'extensions/content-rating/playlist_with_playlists_extension.json'
);
const playlistItemWithPlaylistsAndCrExt = readSchema(
  'extensions/content-rating/playlist_item_with_playlists_extension.json'
);

// `code.source` is what lets standalone mode emit source; `code.formats` points the
// generated module at the format implementations it imports instead of an Ajv instance.
const ajv = addFormats(
  new Ajv2020({
    strict: false,
    allErrors: true,
    allowUnionTypes: true,
    code: { source: true, esm: true, formats: _`formats` },
  })
);

const schemas = [
  playlist,
  playlistGroup,
  refManifest,
  channel,
  playlistsExt,
  playlistBundle,
  playlistWithExt,
  playlistItemWithExt,
  contentRatingExt,
  playlistWithCrExt,
  playlistItemWithCrExt,
  playlistWithPlaylistsAndCrExt,
  playlistItemWithPlaylistsAndCrExt,
];

/**
 * Fail the build if a schema starts using `unevaluatedProperties` / `unevaluatedItems`.
 *
 * Those are the only keywords that read the `validateNN.evaluated = {...}` metadata Ajv writes at
 * the top level of the generated module — the one import-time side effect left in the package,
 * which `"sideEffects": false` in `package.json` now licenses a bundler to drop. Today nothing
 * reads that metadata, so dropping it is harmless. The moment a schema uses one of these keywords
 * it stops being harmless, and the failure would be silent: validation goes wrong rather than
 * throwing. Adding the keyword means dropping the field, or narrowing it to an array that keeps
 * the generated chunk — decide it here, not after a consumer's bundle mis-validates a document.
 */
function assertNoUnevaluatedKeywords(node, schemaId, path = '#') {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child, i) => assertNoUnevaluatedKeywords(child, schemaId, `${path}/${i}`));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'unevaluatedProperties' || key === 'unevaluatedItems') {
      throw new Error(
        `generate-validators: ${schemaId} uses "${key}" at ${path}. Ajv implements it with the ` +
          `top-level \`validateNN.evaluated\` metadata in the generated module, which ` +
          `"sideEffects": false lets a bundler drop — see src/validate/generated and the ` +
          `packaging notes in README.md before allowing this keyword.`
      );
    }
    assertNoUnevaluatedKeywords(value, schemaId, `${path}/${key}`);
  }
}

for (const schema of schemas) {
  assertNoUnevaluatedKeywords(schema, schema.$id ?? '(anonymous schema)');
  ajv.addSchema(schema);
}

function unsignedSchemaId(baseId) {
  return `${baseId}-unsigned`;
}

/**
 * Register a clone of a signed-document schema with the signature anyOf removed.
 * Uses a distinct `$id` so it does not collide with the canonical schema.
 *
 * Invariant: today these schemas use top-level `anyOf` only for
 * `signatures` / legacy `signature`. Do not reuse this helper if `anyOf` gains
 * unrelated branches.
 */
function addUnsignedSchema(base) {
  const id = unsignedSchemaId(base.$id);
  if (ajv.getSchema(id)) return id;
  if (!Array.isArray(base.anyOf)) {
    throw new Error(`generate-validators: ${base.$id} has no top-level anyOf to strip`);
  }
  const unsigned = structuredClone(base);
  delete unsigned.anyOf;
  unsigned.$id = id;
  ajv.addSchema(unsigned);
  return id;
}

/**
 * A composed schema requires signatures through whichever document schema it `$ref`s, so the
 * unsigned variant is the same composition with that one reference swapped for its own
 * `-unsigned` clone. `rewrite` maps each `$ref` in `allOf`: returning a new id replaces it,
 * returning the id unchanged leaves the branch alone (the extension fragments carry no
 * signature rules, so they are shared with the signed variant rather than cloned).
 */
function addUnsignedComposedSchema(composed, rewrite) {
  const composedId = unsignedSchemaId(composed.$id);
  if (ajv.getSchema(composedId)) return composedId;

  const unsignedComposed = structuredClone(composed);
  unsignedComposed.$id = composedId;
  unsignedComposed.allOf = composed.allOf.map(branch => ({ $ref: rewrite(branch.$ref) }));
  ajv.addSchema(unsignedComposed);
  return composedId;
}

/** Playlists extension: core bundle + extension fragment. */
function addUnsignedPlaylistWithExtensionSchema() {
  return addUnsignedComposedSchema(playlistWithExt, ref =>
    ref === playlistBundle.$id ? addUnsignedSchema(playlistBundle) : ref
  );
}

/** Content rating over core: canonical core playlist + content-rating fragment. */
function addUnsignedPlaylistWithContentRatingSchema() {
  return addUnsignedComposedSchema(playlistWithCrExt, ref =>
    ref === playlist.$id ? addUnsignedSchema(playlist) : ref
  );
}

/** Both draft extensions: the playlists composed schema + content-rating fragment. */
function addUnsignedPlaylistWithPlaylistsAndContentRatingSchema() {
  return addUnsignedComposedSchema(playlistWithPlaylistsAndCrExt, ref =>
    ref === playlistWithExt.$id ? addUnsignedPlaylistWithExtensionSchema() : ref
  );
}

/**
 * Export name -> schema reference. Every validator reachable from the public API must be
 * listed here, including the `-unsigned` variants that `{ requireSignatures: false }` uses.
 */
const validators = {
  playlist: playlist.$id,
  playlistUnsigned: addUnsignedSchema(playlist),
  playlistGroup: playlistGroup.$id,
  playlistGroupUnsigned: addUnsignedSchema(playlistGroup),
  channel: channel.$id,
  channelUnsigned: addUnsignedSchema(channel),
  playlistWithExt: playlistWithExt.$id,
  playlistWithExtUnsigned: addUnsignedPlaylistWithExtensionSchema(),
  playlistItemWithExt: playlistItemWithExt.$id,
  refManifest: refManifest.$id,
  playlistsExt: playlistsExt.$id,

  contentRatingExt: contentRatingExt.$id,
  playlistWithCrExt: playlistWithCrExt.$id,
  playlistWithCrExtUnsigned: addUnsignedPlaylistWithContentRatingSchema(),
  playlistItemWithCrExt: playlistItemWithCrExt.$id,
  playlistWithPlaylistsAndCrExt: playlistWithPlaylistsAndCrExt.$id,
  playlistWithPlaylistsAndCrExtUnsigned: addUnsignedPlaylistWithPlaylistsAndContentRatingSchema(),
  playlistItemWithPlaylistsAndCrExt: playlistItemWithPlaylistsAndCrExt.$id,

  playlistItem: `${playlist.$id}#/$defs/PlaylistItem`,
  displayPrefs: `${playlist.$id}#/$defs/DisplayPrefs`,
  reproBlock: `${playlist.$id}#/$defs/ReproBlock`,
  provenanceBlock: `${playlist.$id}#/$defs/ProvenanceBlock`,
  contract: `${playlist.$id}#/$defs/ProvenanceBlock/properties/contract`,
  dependency: `${playlist.$id}#/$defs/ProvenanceBlock/properties/dependencies/items`,
  reproFrameHash: `${playlist.$id}#/$defs/ReproBlock/properties/frameHash`,
  reproEngineVersion: `${playlist.$id}#/$defs/ReproBlock/properties/engineVersion`,

  note: `${playlistsExt.$id}#/$defs/Note`,
  // The playlists and channels extensions both `$ref` the core Ref Manifest's Entity rather
  // than keeping their own copy (dp1 registry 1.0.9), so there is one Entity validator and the
  // two extensions cannot drift from `metadata.artists[]`.
  entity: `${refManifest.$id}#/$defs/Entity`,
  dynamicQuery: `${playlistsExt.$id}#/$defs/DynamicQuery`,
  responseMapping: `${playlistsExt.$id}#/$defs/ResponseMapping`,

  thumbnail: `${refManifest.$id}#/$defs/Thumbnail`,
  artist: `${refManifest.$id}#/$defs/Artist`,
  biography: `${refManifest.$id}#/$defs/Biography`,
  link: `${refManifest.$id}#/$defs/Link`,
  metadata: `${refManifest.$id}#/$defs/Metadata`,
  medium: `${refManifest.$id}#/$defs/Metadata/properties/medium`,
  localizedMetadata: `${refManifest.$id}#/$defs/LocalizedMetadata`,
  controls: `${refManifest.$id}#/$defs/Controls`,
  displayControls: `${refManifest.$id}#/$defs/DisplayControls`,
  safetyControls: `${refManifest.$id}#/$defs/SafetyControls`,
};

/**
 * Ajv emits `require("ajv/dist/runtime/<helper>").<binding>` for its runtime helpers even in
 * ESM mode, which no ESM consumer can evaluate. Rewrite those to imports from our shim.
 * Unknown helpers fail the build rather than shipping a broken module.
 */
const RUNTIME_HELPERS = {
  'require("ajv/dist/runtime/ucs2length").default': 'ucs2length',
};

function replaceRuntimeRequires(source) {
  let out = source;
  const used = new Set();
  for (const [expression, binding] of Object.entries(RUNTIME_HELPERS)) {
    if (!out.includes(expression)) continue;
    out = out.split(expression).join(binding);
    used.add(binding);
  }
  const leftover = out.match(/require\([^)]*\)/g);
  if (leftover) {
    throw new Error(
      `generate-validators: unhandled runtime require(s) in generated code: ${[
        ...new Set(leftover),
      ].join(', ')}. Add them to RUNTIME_HELPERS and re-export them from src/validate/runtime.ts.`
    );
  }
  return { source: out, used: [...used].sort() };
}

const header = `// @generated by scripts/generate-validators.mjs from src/schema/*.json — do not edit.\n`;
const { source, used } = replaceRuntimeRequires(standaloneCode(ajv, validators));
const imports = [`import { ${['formats', ...used].join(', ')} } from '../runtime.js';`];

const names = Object.keys(validators);
const declarations = names.map(name => `export declare const ${name}: StandaloneValidator;`);
const types = `${header}
/** Ajv standalone validator: returns false and populates \`errors\` on failure. */
export type StandaloneValidator = ((data: unknown) => boolean) & {
  errors?: Array<{ instancePath?: string; message?: string }> | null;
};

${declarations.join('\n')}
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'validators.js'), `${header}${imports.join('\n')}\n${source}\n`);
writeFileSync(join(outDir, 'validators.d.ts'), types);

process.stdout.write(
  `generate-validators: wrote ${names.length} validators to ${join(dirname(outDir), 'generated')}\n`
);
