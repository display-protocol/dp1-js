import { generateId, nowIso } from './helpers.js';
import type { PlaylistGroup } from './types.js';
import { PlaylistGroup as ValidatePlaylistGroup } from '../validate/index.js';

/**
 * @deprecated The DP-1 spec removed the Playlist-Group (Exhibition) object
 * (display-protocol/dp1#41): channels superseded it before it saw production use, and
 * zero groups were ever published. Use the channels extension instead
 * (`ChannelBuilder`, `ValidateChannel`, `VerifyChannelSignatures`). Retained for
 * backward compatibility and dp1-go parity; scheduled for removal in the next major.
 */
export class PlaylistGroupBuilder {
  private doc: Partial<PlaylistGroup> = { playlists: [] };

  id(value: string) {
    this.doc.id = value;
    return this;
  }

  slug(value: string) {
    this.doc.slug = value;
    return this;
  }

  title(value: string) {
    this.doc.title = value;
    return this;
  }

  curator(value: string) {
    this.doc.curator = value;
    return this;
  }

  summary(value: string) {
    this.doc.summary = value;
    return this;
  }

  addPlaylist(uri: string) {
    if (!this.doc.playlists) this.doc.playlists = [];
    this.doc.playlists.push(uri);
    return this;
  }

  playlists(uris: string[]) {
    this.doc.playlists = uris;
    return this;
  }

  created(value: string) {
    this.doc.created = value;
    return this;
  }

  coverImage(value: string) {
    this.doc.coverImage = value;
    return this;
  }

  /** Build an unsigned playlist-group document and schema-validate it. */
  build(): PlaylistGroup {
    if (this.doc.id === undefined) this.doc.id = generateId();
    if (this.doc.created === undefined) this.doc.created = nowIso();

    const out: PlaylistGroup = {
      id: this.doc.id,
      title: String(this.doc.title ?? ''),
      playlists: this.doc.playlists ?? [],
      created: this.doc.created,
      ...(this.doc.slug === undefined ? {} : { slug: this.doc.slug }),
      ...(this.doc.curator === undefined ? {} : { curator: this.doc.curator }),
      ...(this.doc.summary === undefined ? {} : { summary: this.doc.summary }),
      ...(this.doc.coverImage === undefined ? {} : { coverImage: this.doc.coverImage }),
    };
    ValidatePlaylistGroup(out, { requireSignatures: false });
    return structuredClone(out);
  }
}
