import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import playlist from '../schema/core/playlist.json' with { type: 'json' };
import playlistGroup from '../schema/core/playlist-group.json' with { type: 'json' };
import refManifest from '../schema/core/ref-manifest.json' with { type: 'json' };
import channel from '../schema/extensions/channels/schema.json' with { type: 'json' };
import playlistsExt from '../schema/extensions/playlists/schema.json' with { type: 'json' };
import playlistBundle from '../schema/extensions/playlists/bundles/playlist-core-v1.1.0.json' with { type: 'json' };
import playlistWithExt from '../schema/extensions/playlists/playlist_with_extension.json' with { type: 'json' };
import playlistItemWithExt from '../schema/extensions/playlists/playlist_item_with_extension.json' with { type: 'json' };
import { ErrValidation } from '../errors.js';

const ajv = addFormats(new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true }));
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

export type RequireSignaturesOptions = {
  /**
   * When true (default), the document must include `signatures` or legacy `signature`
   * per the DP-1 schema. Set false to schema-validate unsigned drafts.
   */
  requireSignatures?: boolean;
};

/** @deprecated Prefer `RequireSignaturesOptions`. */
export type ValidatePlaylistOptions = RequireSignaturesOptions;

function unsignedSchemaId(baseId: string): string {
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
function ensureUnsignedSchema(base: { readonly $id: string }): string {
  const id = unsignedSchemaId(base.$id);
  if (ajv.getSchema(id)) return id;
  const unsigned = structuredClone(base) as Record<string, unknown>;
  delete unsigned.anyOf;
  unsigned.$id = id;
  ajv.addSchema(unsigned);
  return id;
}

/**
 * Composed playlist+extension schema requires signatures via the bundle $ref.
 * Clone the bundle without signature anyOf, then point a composed schema at it.
 */
function ensureUnsignedPlaylistWithExtensionSchema(): string {
  const composedId = unsignedSchemaId(playlistWithExt.$id);
  if (ajv.getSchema(composedId)) return composedId;

  const bundleId = unsignedSchemaId(playlistBundle.$id);
  if (!ajv.getSchema(bundleId)) {
    const unsignedBundle = structuredClone(playlistBundle) as Record<string, unknown>;
    delete unsignedBundle.anyOf;
    unsignedBundle.$id = bundleId;
    ajv.addSchema(unsignedBundle);
  }

  const unsignedComposed = structuredClone(playlistWithExt) as {
    $id: string;
    allOf: Array<{ $ref: string }>;
  };
  unsignedComposed.$id = composedId;
  unsignedComposed.allOf = [{ $ref: bundleId }, { $ref: playlistsExt.$id }];
  ajv.addSchema(unsignedComposed);
  return composedId;
}

function validationError(
  message: string,
  details: Array<{ path: string; message: string }>,
  cause?: unknown
) {
  return Object.assign(new Error(message), {
    cause: cause ?? ErrValidation,
    details,
  });
}

function formatAjvErrors() {
  return (ajv.errors ?? []).map(err => {
    const path = err.instancePath || '/';
    const message = err.message ?? 'validation failed';
    return { path, message };
  });
}

function parseInput(data: Buffer | string | unknown): unknown {
  if (typeof data === 'string' || Buffer.isBuffer(data)) {
    try {
      return JSON.parse(Buffer.isBuffer(data) ? data.toString('utf8') : data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw validationError(`${ErrValidation.message}: json: ${message}`, [{ path: '/', message }]);
    }
  }
  return data;
}

function validate(schemaId: string, data: Buffer | string | unknown) {
  const doc = parseInput(data);
  const ok = ajv.validate(schemaId, doc);
  if (!ok) throw validationError(ErrValidation.message, formatAjvErrors());
}

function validateSignedDocument(
  base: { readonly $id: string },
  data: Buffer | string | unknown,
  options?: RequireSignaturesOptions
): void {
  const requireSignatures = options?.requireSignatures !== false;
  if (requireSignatures) {
    validate(base.$id, data);
    return;
  }
  validate(ensureUnsignedSchema(base), data);
}

/**
 * Validate a playlist JSON document against the core DP-1 playlist schema.
 * Defaults to requiring signatures; pass `{ requireSignatures: false }` for unsigned drafts.
 */
export function Playlist(
  data: Buffer | string | unknown,
  options?: RequireSignaturesOptions
): void {
  validateSignedDocument(playlist, data, options);
}

/**
 * Validate a playlist-group JSON document against the core schema.
 * Defaults to requiring signatures; pass `{ requireSignatures: false }` for unsigned drafts.
 *
 * @deprecated The DP-1 spec removed the Playlist-Group (Exhibition) object
 * (display-protocol/dp1#41): channels superseded it before it saw production use, and
 * zero groups were ever published. Use the channels extension instead
 * (`ChannelBuilder`, `ValidateChannel`, `VerifyChannelSignatures`). Retained for
 * backward compatibility and dp1-go parity; scheduled for removal in the next major.
 */
export function PlaylistGroup(
  data: Buffer | string | unknown,
  options?: RequireSignaturesOptions
): void {
  validateSignedDocument(playlistGroup, data, options);
}

/**
 * Validate a channel extension JSON document.
 * Defaults to requiring signatures; pass `{ requireSignatures: false }` for unsigned drafts.
 */
export function ChannelsExtension(
  data: Buffer | string | unknown,
  options?: RequireSignaturesOptions
): void {
  validateSignedDocument(channel, data, options);
}

export function PlaylistWithPlaylistsExtension(
  data: Buffer | string | unknown,
  options?: RequireSignaturesOptions
): void {
  const requireSignatures = options?.requireSignatures !== false;
  if (requireSignatures) {
    validate(playlistWithExt.$id, data);
    return;
  }
  validate(ensureUnsignedPlaylistWithExtensionSchema(), data);
}
export const RefManifest = (data: Buffer | string | unknown) => validate(refManifest.$id, data);
export const PlaylistsExtensionFragment = (data: Buffer | string | unknown) =>
  validate(playlistsExt.$id, data);
export const PlaylistItem = (data: Buffer | string | unknown) =>
  validate(`${playlist.$id}#/$defs/PlaylistItem`, data);
export const parsePlaylistItem = PlaylistItem;
/**
 * Core PlaylistItem + the playlists-extension overlay (note / displayAt / inlineManifest).
 * Used by dynamicQuery.
 *
 * The overlay is a single `$defs/PlaylistItemExtension` shared with the playlist-level
 * composed schema, so both validation paths enforce the same per-item fields.
 */
export const PlaylistItemWithPlaylistsExtension = (data: Buffer | string | unknown) =>
  validate(playlistItemWithExt.$id, data);

// --- Leaf / $defs validators (schema-only; used by builders) ---

export const Note = (data: Buffer | string | unknown) =>
  validate(`${playlistsExt.$id}#/$defs/Note`, data);
export const Entity = (data: Buffer | string | unknown) =>
  validate(`${playlistsExt.$id}#/$defs/Entity`, data);
export const DynamicQuery = (data: Buffer | string | unknown) =>
  validate(`${playlistsExt.$id}#/$defs/DynamicQuery`, data);
export const ResponseMapping = (data: Buffer | string | unknown) =>
  validate(`${playlistsExt.$id}#/$defs/ResponseMapping`, data);

export const DisplayPrefs = (data: Buffer | string | unknown) =>
  validate(`${playlist.$id}#/$defs/DisplayPrefs`, data);
export const ReproBlock = (data: Buffer | string | unknown) =>
  validate(`${playlist.$id}#/$defs/ReproBlock`, data);
export const ProvenanceBlock = (data: Buffer | string | unknown) =>
  validate(`${playlist.$id}#/$defs/ProvenanceBlock`, data);
/** Nested contract object under ProvenanceBlock (not a top-level $def). */
export const Contract = (data: Buffer | string | unknown) =>
  validate(`${playlist.$id}#/$defs/ProvenanceBlock/properties/contract`, data);
/** Nested dependency item under ProvenanceBlock.dependencies. */
export const Dependency = (data: Buffer | string | unknown) =>
  validate(`${playlist.$id}#/$defs/ProvenanceBlock/properties/dependencies/items`, data);
export const ReproFrameHash = (data: Buffer | string | unknown) =>
  validate(`${playlist.$id}#/$defs/ReproBlock/properties/frameHash`, data);
export const ReproEngineVersion = (data: Buffer | string | unknown) =>
  validate(`${playlist.$id}#/$defs/ReproBlock/properties/engineVersion`, data);

export const Thumbnail = (data: Buffer | string | unknown) =>
  validate(`${refManifest.$id}#/$defs/Thumbnail`, data);
export const Artist = (data: Buffer | string | unknown) =>
  validate(`${refManifest.$id}#/$defs/Artist`, data);
export const Metadata = (data: Buffer | string | unknown) =>
  validate(`${refManifest.$id}#/$defs/Metadata`, data);
/** Localized text overrides under `i18n` (title / description / creditLine only). */
export const LocalizedMetadata = (data: Buffer | string | unknown) =>
  validate(`${refManifest.$id}#/$defs/LocalizedMetadata`, data);
export const Controls = (data: Buffer | string | unknown) =>
  validate(`${refManifest.$id}#/$defs/Controls`, data);
export const DisplayControls = (data: Buffer | string | unknown) =>
  validate(`${refManifest.$id}#/$defs/DisplayControls`, data);
export const SafetyControls = (data: Buffer | string | unknown) =>
  validate(`${refManifest.$id}#/$defs/SafetyControls`, data);
