/**
 * Precompile the DP-1 JSON schemas into standalone JavaScript validators.
 *
 * Ajv normally compiles schemas with `new Function(...)` on first use, which throws
 * `Code generation from strings disallowed for this context` on runtimes that forbid
 * dynamic codegen (Cloudflare Workers / workerd, Deno Deploy, CSP-restricted browsers).
 * Compiling ahead of time keeps `src/schema/*.json` the single source of truth while
 * shipping plain functions that run anywhere.
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

for (const schema of [
  playlist,
  playlistGroup,
  refManifest,
  channel,
  playlistsExt,
  playlistBundle,
  playlistWithExt,
  playlistItemWithExt,
]) {
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
 * Composed playlist+extension schema requires signatures via the bundle $ref.
 * Clone the bundle without signature anyOf, then point a composed schema at it.
 */
function addUnsignedPlaylistWithExtensionSchema() {
  const composedId = unsignedSchemaId(playlistWithExt.$id);
  if (ajv.getSchema(composedId)) return composedId;

  const bundleId = addUnsignedSchema(playlistBundle);
  const unsignedComposed = structuredClone(playlistWithExt);
  unsignedComposed.$id = composedId;
  unsignedComposed.allOf = [{ $ref: bundleId }, { $ref: playlistsExt.$id }];
  ajv.addSchema(unsignedComposed);
  return composedId;
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

  playlistItem: `${playlist.$id}#/$defs/PlaylistItem`,
  displayPrefs: `${playlist.$id}#/$defs/DisplayPrefs`,
  reproBlock: `${playlist.$id}#/$defs/ReproBlock`,
  provenanceBlock: `${playlist.$id}#/$defs/ProvenanceBlock`,
  contract: `${playlist.$id}#/$defs/ProvenanceBlock/properties/contract`,
  dependency: `${playlist.$id}#/$defs/ProvenanceBlock/properties/dependencies/items`,
  reproFrameHash: `${playlist.$id}#/$defs/ReproBlock/properties/frameHash`,
  reproEngineVersion: `${playlist.$id}#/$defs/ReproBlock/properties/engineVersion`,

  note: `${playlistsExt.$id}#/$defs/Note`,
  entity: `${playlistsExt.$id}#/$defs/Entity`,
  dynamicQuery: `${playlistsExt.$id}#/$defs/DynamicQuery`,
  responseMapping: `${playlistsExt.$id}#/$defs/ResponseMapping`,

  thumbnail: `${refManifest.$id}#/$defs/Thumbnail`,
  artist: `${refManifest.$id}#/$defs/Artist`,
  metadata: `${refManifest.$id}#/$defs/Metadata`,
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
