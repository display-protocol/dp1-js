/**
 * Schema validation against precompiled (Ajv standalone) validators.
 *
 * The validators in `./generated/validators.js` are built from `src/schema/*.json` by
 * `scripts/generate-validators.mjs`. Nothing here compiles a schema at runtime, so
 * validation works on Cloudflare Workers and other Node-compatible runtimes that forbid
 * dynamic code generation. Add a schema or a `$defs` entry point by editing the manifest in
 * that script, never by hand-editing the generated files.
 */
import { isBinary, toText, type BinaryLike } from '../runtime/bytes.js';
import * as validators from './generated/validators.js';
import type { StandaloneValidator } from './generated/validators.js';
import { ErrValidation } from '../errors.js';

export type RequireSignaturesOptions = {
  /**
   * When true (default), the document must include `signatures` or legacy `signature`
   * per the DP-1 schema. Set false to schema-validate unsigned drafts.
   */
  requireSignatures?: boolean;
};

/** @deprecated Prefer `RequireSignaturesOptions`. */
export type ValidatePlaylistOptions = RequireSignaturesOptions;

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

function formatAjvErrors(validator: StandaloneValidator) {
  return (validator.errors ?? []).map(err => {
    const path = err.instancePath || '/';
    const message = err.message ?? 'validation failed';
    return { path, message };
  });
}

function parseInput(data: BinaryLike | unknown): unknown {
  if (typeof data === 'string' || isBinary(data)) {
    try {
      return JSON.parse(toText(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw validationError(`${ErrValidation.message}: json: ${message}`, [{ path: '/', message }]);
    }
  }
  return data;
}

function validate(validator: StandaloneValidator, data: BinaryLike | unknown) {
  const doc = parseInput(data);
  if (!validator(doc)) throw validationError(ErrValidation.message, formatAjvErrors(validator));
}

/**
 * Pick the signed or unsigned variant of a document schema. The `-unsigned` variants are
 * precompiled clones with the top-level signature `anyOf` removed; see the generator.
 */
function validateSignedDocument(
  signed: StandaloneValidator,
  unsigned: StandaloneValidator,
  data: BinaryLike | unknown,
  options?: RequireSignaturesOptions
): void {
  const requireSignatures = options?.requireSignatures !== false;
  validate(requireSignatures ? signed : unsigned, data);
}

/**
 * Validate a playlist JSON document against the core DP-1 playlist schema.
 * Defaults to requiring signatures; pass `{ requireSignatures: false }` for unsigned drafts.
 */
export function Playlist(data: BinaryLike | unknown, options?: RequireSignaturesOptions): void {
  validateSignedDocument(validators.playlist, validators.playlistUnsigned, data, options);
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
  data: BinaryLike | unknown,
  options?: RequireSignaturesOptions
): void {
  validateSignedDocument(validators.playlistGroup, validators.playlistGroupUnsigned, data, options);
}

/**
 * Validate a channel extension JSON document.
 * Defaults to requiring signatures; pass `{ requireSignatures: false }` for unsigned drafts.
 */
export function ChannelsExtension(
  data: BinaryLike | unknown,
  options?: RequireSignaturesOptions
): void {
  validateSignedDocument(validators.channel, validators.channelUnsigned, data, options);
}

export function PlaylistWithPlaylistsExtension(
  data: BinaryLike | unknown,
  options?: RequireSignaturesOptions
): void {
  validateSignedDocument(
    validators.playlistWithExt,
    validators.playlistWithExtUnsigned,
    data,
    options
  );
}
export const RefManifest = (data: BinaryLike | unknown) => validate(validators.refManifest, data);
export const PlaylistsExtensionFragment = (data: BinaryLike | unknown) =>
  validate(validators.playlistsExt, data);
export const PlaylistItem = (data: BinaryLike | unknown) => validate(validators.playlistItem, data);
export const parsePlaylistItem = PlaylistItem;
/**
 * Core PlaylistItem + the playlists-extension overlay (note / displayAt / inlineManifest).
 * Used by dynamicQuery.
 *
 * The overlay is a single `$defs/PlaylistItemExtension` shared with the playlist-level
 * composed schema, so both validation paths enforce the same per-item fields.
 */
export const PlaylistItemWithPlaylistsExtension = (data: BinaryLike | unknown) =>
  validate(validators.playlistItemWithExt, data);

// --- Leaf / $defs validators (schema-only; used by builders) ---

export const Note = (data: BinaryLike | unknown) => validate(validators.note, data);
export const Entity = (data: BinaryLike | unknown) => validate(validators.entity, data);
export const DynamicQuery = (data: BinaryLike | unknown) => validate(validators.dynamicQuery, data);
export const ResponseMapping = (data: BinaryLike | unknown) =>
  validate(validators.responseMapping, data);

export const DisplayPrefs = (data: BinaryLike | unknown) => validate(validators.displayPrefs, data);
export const ReproBlock = (data: BinaryLike | unknown) => validate(validators.reproBlock, data);
export const ProvenanceBlock = (data: BinaryLike | unknown) =>
  validate(validators.provenanceBlock, data);
/** Nested contract object under ProvenanceBlock (not a top-level $def). */
export const Contract = (data: BinaryLike | unknown) => validate(validators.contract, data);
/** Nested dependency item under ProvenanceBlock.dependencies. */
export const Dependency = (data: BinaryLike | unknown) => validate(validators.dependency, data);
export const ReproFrameHash = (data: BinaryLike | unknown) =>
  validate(validators.reproFrameHash, data);
export const ReproEngineVersion = (data: BinaryLike | unknown) =>
  validate(validators.reproEngineVersion, data);

export const Thumbnail = (data: BinaryLike | unknown) => validate(validators.thumbnail, data);
export const Artist = (data: BinaryLike | unknown) => validate(validators.artist, data);
export const Metadata = (data: BinaryLike | unknown) => validate(validators.metadata, data);
/** Localized text overrides under `i18n` (title / description / creditLine only). */
export const LocalizedMetadata = (data: BinaryLike | unknown) =>
  validate(validators.localizedMetadata, data);
export const Controls = (data: BinaryLike | unknown) => validate(validators.controls, data);
export const DisplayControls = (data: BinaryLike | unknown) =>
  validate(validators.displayControls, data);
export const SafetyControls = (data: BinaryLike | unknown) =>
  validate(validators.safetyControls, data);
