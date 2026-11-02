/**
 * Draft DP-1 content-rating extension (registry 1.0.7): a curatorial audience label on a
 * playlist item.
 *
 * The wire vocabulary is open (extension §3.3): any string is a valid `contentRating`,
 * and `v0.1.0` defines only `'general'` and `'mature'`. Absence, or a value a consumer
 * does not recognize, means unrated — nothing is assumed from an unknown label, so an
 * unfamiliar rating never causes an item to be hidden. Only `'mature'` hides anything.
 *
 * `contentRating` is therefore typed `string` everywhere in this package rather than as a
 * closed union: a rating from a later vocabulary round-trips unchanged. Use
 * `isKnownContentRating` to branch on the values this SDK version understands, never to
 * decide whether a document is valid.
 */

export const ContentRatingGeneral = 'general';
export const ContentRatingMature = 'mature';

/**
 * Reports whether `value` is a content rating this SDK version defines.
 *
 * A `false` result is not an error and not a reason to reject the item: per extension §3.3
 * an unrecognized rating is treated exactly as an absent one, i.e. unrated. Branch on this
 * only to decide whether a label can be acted on, never to decide whether a document is
 * valid.
 */
export function isKnownContentRating(value: string | undefined): boolean {
  return value === ContentRatingGeneral || value === ContentRatingMature;
}

export {
  ContentRatingExtensionFragment as ValidateContentRatingExtensionFragment,
  PlaylistItemWithContentRatingExtension as ValidatePlaylistItemWithContentRatingExtension,
  PlaylistItemWithPlaylistsAndContentRatingExtensions as ValidatePlaylistItemWithPlaylistsAndContentRatingExtensions,
  PlaylistWithContentRatingExtension as ValidatePlaylistWithContentRatingExtension,
  PlaylistWithPlaylistsAndContentRatingExtensions as ValidatePlaylistWithPlaylistsAndContentRatingExtensions,
} from '../../validate/index.js';
