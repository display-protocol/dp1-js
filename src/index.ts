import * as errors from './errors.js';
export { errors };
export {
  CodedError,
  ErrorCode,
  ErrValidation,
  ErrSigInvalid,
  ErrUnsupportedAlg,
  ErrNoSignatures,
  withCode,
  codeFromValidation,
} from './errors.js';
export { transform as JcsTransform } from './jcs/index.js';
import * as validate from './validate/index.js';
import { parsePlaylist } from './playlist/index.js';
export * from './sign/index.js';
export {
  parsePlaylist,
  clonePlaylist,
  PlaylistDocument,
  HydrateDynamicQueryString,
  PlaylistItemsFromDynamicQuery,
  clonePlaylistWithDynamicQuery,
  ResolveDynamicQuery,
} from './playlist/index.js';
export { parsePlaylistGroup, PlaylistGroupDocument } from './playlistgroup/index.js';
export { parseRefManifest, RefManifestDocument } from './refmanifest/index.js';
export * from './merge/index.js';
export * from './extension/channels/index.js';
export { parseEntity, EntityDocument } from './extension/identity/index.js';
export {
  parsePlaylistsExtension,
  PlaylistsExtensionDocument,
} from './extension/playlists/index.js';
export {
  PlaylistItem as ValidatePlaylistItem,
  PlaylistsExtensionFragment as ValidatePlaylistsExtensionFragment,
} from './validate/index.js';

export const SchemaHooks = {
  PlaylistCoreSchemaValidate: validate.Playlist,
  PlaylistWithPlaylistsExtensionSchemaValidate: validate.PlaylistWithPlaylistsExtension,
  PlaylistGroupSchemaValidate: validate.PlaylistGroup,
  RefManifestSchemaValidate: validate.RefManifest,
  ChannelExtensionSchemaValidate: validate.ChannelsExtension,
};

function collectErrorDetails(err: unknown) {
  if (err && typeof err === 'object') {
    const details = (err as { details?: unknown }).details;
    if (Array.isArray(details)) {
      return details.flatMap(detail => {
        if (detail && typeof detail === 'object') {
          const path = String((detail as { path?: unknown }).path ?? '/');
          const message = String((detail as { message?: unknown }).message ?? '');
          return [{ path, message: message || 'validation failed' }];
        }
        const message = String(detail);
        return [{ path: '/', message }];
      });
    }
  }
  if (err instanceof Error) {
    return [{ path: '/', message: err.message }];
  }
  const message = String(err);
  return message ? [{ path: '/', message }] : [];
}

export function parseDP1Playlist(input: Parameters<typeof parsePlaylist>[0]) {
  try {
    const playlist = parsePlaylist(input);
    return { playlist, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      playlist: null,
      error: {
        message,
        details: collectErrorDetails(err),
      },
    };
  }
}

function decodeJSON(data: Buffer | string, label: string) {
  try {
    return JSON.parse(Buffer.isBuffer(data) ? data.toString('utf8') : String(data));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`dp1: decode ${label}: ${message}`);
  }
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`dp1: decode ${label}: expected object`);
  return value as Record<string, unknown>;
}

function assertString(value: unknown, field: string, label: string) {
  if (typeof value !== 'string')
    throw new Error(`dp1: decode ${label}: field ${field} must be string`);
}

function assertArray(value: unknown, field: string, label: string) {
  if (!Array.isArray(value)) throw new Error(`dp1: decode ${label}: field ${field} must be array`);
}

export function ParseAndValidatePlaylist(data: Buffer | string) {
  try {
    SchemaHooks.PlaylistCoreSchemaValidate(data);
  } catch (err) {
    throw errors.codeFromValidation(errors.ErrorCode.PlaylistInvalid, err) ?? err;
  }
  const doc = assertObject(decodeJSON(data, 'playlist'), 'playlist');
  assertString(doc.dpVersion, 'dpVersion', 'playlist');
  assertString(doc.title, 'title', 'playlist');
  assertArray(doc.items, 'items', 'playlist');
  for (const item of doc.items as unknown[]) {
    const it = assertObject(item, 'playlist');
    assertString(it.source, 'items.source', 'playlist');
  }
  return doc;
}

export function ParseAndValidatePlaylistWithPlaylistsExtension(data: Buffer | string) {
  try {
    SchemaHooks.PlaylistWithPlaylistsExtensionSchemaValidate(data);
  } catch (err) {
    throw errors.codeFromValidation(errors.ErrorCode.PlaylistInvalid, err) ?? err;
  }
  const doc = assertObject(decodeJSON(data, 'playlist'), 'playlist');
  assertString(doc.dpVersion, 'dpVersion', 'playlist');
  assertString(doc.title, 'title', 'playlist');
  assertArray(doc.items, 'items', 'playlist');
  return doc;
}

export function ParseAndValidatePlaylistGroup(data: Buffer | string) {
  try {
    SchemaHooks.PlaylistGroupSchemaValidate(data);
  } catch (err) {
    throw errors.codeFromValidation(errors.ErrorCode.PlaylistGroupInvalid, err) ?? err;
  }
  const doc = assertObject(decodeJSON(data, 'playlist-group'), 'playlist-group');
  assertString(doc.id, 'id', 'playlist-group');
  assertString(doc.title, 'title', 'playlist-group');
  assertArray(doc.playlists, 'playlists', 'playlist-group');
  assertString(doc.created, 'created', 'playlist-group');
  return doc;
}

export function ParseAndValidateRefManifest(data: Buffer | string) {
  try {
    SchemaHooks.RefManifestSchemaValidate(data);
  } catch (err) {
    throw errors.codeFromValidation(errors.ErrorCode.RefManifestInvalid, err) ?? err;
  }
  const doc = assertObject(decodeJSON(data, 'ref manifest'), 'ref manifest');
  assertString(doc.refVersion, 'refVersion', 'ref manifest');
  assertString(doc.id, 'id', 'ref manifest');
  assertString(doc.created, 'created', 'ref manifest');
  assertString(doc.locale, 'locale', 'ref manifest');
  return doc;
}

export function ParseAndValidateChannel(data: Buffer | string) {
  try {
    SchemaHooks.ChannelExtensionSchemaValidate(data);
  } catch (err) {
    throw errors.codeFromValidation(errors.ErrorCode.ChannelInvalid, err) ?? err;
  }
  const doc = assertObject(decodeJSON(data, 'channel'), 'channel');
  assertString(doc.id, 'id', 'channel');
  assertString(doc.slug, 'slug', 'channel');
  assertString(doc.title, 'title', 'channel');
  assertString(doc.version, 'version', 'channel');
  assertString(doc.created, 'created', 'channel');
  assertArray(doc.playlists, 'playlists', 'channel');
  return doc;
}

export function ParseDPVersion(s: string) {
  if (typeof s !== 'string') throw new Error('dp1: invalid semver');
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+].*)?$/.exec(s);
  if (!match) throw new Error('dp1: invalid semver');
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), raw: s };
}

type VersionLike = { major?: number; raw?: string } | null | undefined;

export function WarnMajorMismatch(document: VersionLike, wantMajor: number) {
  if (!document) return null;
  if (document.major !== wantMajor)
    throw new Error(
      `dp1: major version mismatch: document ${document.raw}, want major ${wantMajor}`
    );
  return null;
}
