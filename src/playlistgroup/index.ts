/**
 * @deprecated The DP-1 spec removed the Playlist-Group (Exhibition) object
 * (display-protocol/dp1#41): channels superseded it before it saw production use, and
 * zero groups were ever published. Use the channels extension instead
 * (`ChannelBuilder`, `ValidateChannel`, `VerifyChannelSignatures`). Retained for
 * backward compatibility and dp1-go parity; scheduled for removal in the next major.
 */
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

/**
 * @deprecated The DP-1 spec removed the Playlist-Group (Exhibition) object
 * (display-protocol/dp1#41): channels superseded it before it saw production use, and
 * zero groups were ever published. Use the channels extension instead
 * (`ChannelBuilder`, `ValidateChannel`, `VerifyChannelSignatures`). Retained for
 * backward compatibility and dp1-go parity; scheduled for removal in the next major.
 */
export class PlaylistGroupDocument {
  constructor(data: Record<string, unknown> = {}) {
    Object.assign(this, structuredClone(data));
  }
}
