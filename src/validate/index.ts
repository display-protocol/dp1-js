import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import playlist from '../schema/core/playlist.json' with { type: 'json' };
import playlistGroup from '../schema/core/playlist-group.json' with { type: 'json' };
import refManifest from '../schema/core/ref-manifest.json' with { type: 'json' };
import channel from '../schema/extensions/channels/schema.json' with { type: 'json' };
import playlistsExt from '../schema/extensions/playlists/schema.json' with { type: 'json' };
import playlistBundle from '../schema/extensions/playlists/bundles/playlist-core-v1.1.0.json' with { type: 'json' };
import playlistWithExt from '../schema/extensions/playlists/playlist_with_extension.json' with { type: 'json' };
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
]) {
  ajv.addSchema(schema);
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

function validate(schemaId: string, data: Buffer | string) {
  let doc: unknown;
  try {
    doc = JSON.parse(Buffer.isBuffer(data) ? data.toString('utf8') : String(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw validationError(`${ErrValidation.message}: json: ${message}`, [{ path: '/', message }]);
  }
  const ok = ajv.validate(schemaId, doc);
  if (!ok) throw validationError(ErrValidation.message, formatAjvErrors());
}

export const Playlist = (data: Buffer | string) => validate(playlist.$id, data);
export const PlaylistWithPlaylistsExtension = (data: Buffer | string) =>
  validate(playlistWithExt.$id, data);
export const PlaylistGroup = (data: Buffer | string) => validate(playlistGroup.$id, data);
export const RefManifest = (data: Buffer | string) => validate(refManifest.$id, data);
export const ChannelsExtension = (data: Buffer | string) => validate(channel.$id, data);
export const PlaylistsExtensionFragment = (data: Buffer | string) =>
  validate(playlistsExt.$id, data);
export const PlaylistItem = (data: Buffer | string) =>
  validate(`${playlist.$id}#/$defs/PlaylistItem`, data);
export const parsePlaylistItem = PlaylistItem;
