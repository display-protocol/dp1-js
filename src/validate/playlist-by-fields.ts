/**
 * The one rule for which playlist schema a document is held to. `PlaylistBuilder.build()` and
 * the parse helpers both go through it, so the SDK never rejects what it just built.
 */
import {
  Playlist,
  PlaylistWithContentRatingExtension,
  PlaylistWithPlaylistsAndContentRatingExtensions,
  PlaylistWithPlaylistsExtension,
  type RequireSignaturesOptions,
} from './index.js';

const playlistFields = [
  'note',
  'curators',
  'summary',
  'openAt',
  'coverImage',
  'dynamicQuery',
  'links',
  'visibility',
  'satellites',
] as const;
const playlistsItemFields = ['note', 'displayAt', 'inlineManifest'] as const;
const contentRatingItemFields = ['contentRating', 'contentReasons'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function anyItemHas(items: unknown, fields: readonly string[]) {
  return (
    Array.isArray(items) &&
    items.some(item => isRecord(item) && fields.some(field => item[field] !== undefined))
  );
}

/**
 * Validate a playlist against the narrowest schema its fields require: core only, the playlists
 * extension, the draft content-rating extension, or both composed. An empty `items` list always
 * needs the playlists extension, whose core bundle allows it when `dynamicQuery` is present.
 */
export function PlaylistByFields(
  data: Buffer | string | unknown,
  options?: RequireSignaturesOptions
): void {
  let doc: unknown = data;
  if (typeof data === 'string' || Buffer.isBuffer(data)) {
    try {
      doc = JSON.parse(data.toString());
    } catch {
      // Let the core validator report the JSON error in its usual shape.
      return Playlist(data, options);
    }
  }
  const record = isRecord(doc) ? doc : {};
  const needsPlaylistsExt =
    playlistFields.some(field => record[field] !== undefined) ||
    (Array.isArray(record.items) && record.items.length === 0) ||
    anyItemHas(record.items, playlistsItemFields);
  const needsContentRating = anyItemHas(record.items, contentRatingItemFields);

  const validateDocument =
    needsPlaylistsExt && needsContentRating
      ? PlaylistWithPlaylistsAndContentRatingExtensions
      : needsPlaylistsExt
        ? PlaylistWithPlaylistsExtension
        : needsContentRating
          ? PlaylistWithContentRatingExtension
          : Playlist;
  // `data`, not `doc`: a JSON document that is itself a string must not be parsed twice.
  validateDocument(data, options);
}
