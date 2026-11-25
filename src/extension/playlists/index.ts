import { PlaylistsExtensionFragment } from '../../validate/index.js';

/** Validate an already-parsed playlists-extension fragment against its schema and return it. */
export function parsePlaylistsExtension(doc: unknown) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new Error('dp1: playlists extension must be an object');
  PlaylistsExtensionFragment(doc);
  return doc;
}

export class PlaylistsExtensionDocument {
  constructor(data: Record<string, unknown> = {}) {
    Object.assign(this, structuredClone(data));
  }
}
