export function parsePlaylistGroup(doc: unknown) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new Error('dp1: playlist-group must be an object');
  const obj = doc as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.title !== 'string' ||
    !Array.isArray(obj.playlists)
  ) {
    throw new Error('dp1: invalid playlist-group');
  }
  return doc;
}

export class PlaylistGroupDocument {
  constructor(data: Record<string, unknown> = {}) {
    Object.assign(this, structuredClone(data));
  }
}
