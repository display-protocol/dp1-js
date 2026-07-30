import { generateId, nowIso, resolve } from './helpers.js';
import type { Channel, Entity } from './types.js';
import type { EntityBuilder } from './entity.js';
import { ChannelsExtension as ValidateChannel } from '../validate/index.js';

export class ChannelBuilder {
  private doc: Partial<Channel> = { playlists: [] };

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

  version(value: string) {
    this.doc.version = value as Channel['version'];
    return this;
  }

  created(value: string) {
    this.doc.created = value;
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

  addCurator(value: Entity | EntityBuilder) {
    if (!this.doc.curators) this.doc.curators = [];
    this.doc.curators.push(resolve(value));
    return this;
  }

  curators(values: Array<Entity | EntityBuilder>) {
    this.doc.curators = values.map(v => resolve(v));
    return this;
  }

  publisher(value: Entity | EntityBuilder) {
    this.doc.publisher = resolve(value);
    return this;
  }

  summary(value: string) {
    this.doc.summary = value;
    return this;
  }

  coverImage(value: string) {
    this.doc.coverImage = value;
    return this;
  }

  /** Build an unsigned channel document and schema-validate it. */
  build(): Channel {
    if (this.doc.id === undefined) this.doc.id = generateId();
    if (this.doc.created === undefined) this.doc.created = nowIso();

    const out: Channel = {
      id: this.doc.id,
      slug: String(this.doc.slug ?? ''),
      title: String(this.doc.title ?? ''),
      version: String(this.doc.version ?? '1.0.0') as Channel['version'],
      created: this.doc.created,
      playlists: this.doc.playlists ?? [],
      ...(this.doc.curators === undefined ? {} : { curators: this.doc.curators }),
      ...(this.doc.publisher === undefined ? {} : { publisher: this.doc.publisher }),
      ...(this.doc.summary === undefined ? {} : { summary: this.doc.summary }),
      ...(this.doc.coverImage === undefined ? {} : { coverImage: this.doc.coverImage }),
    };
    ValidateChannel(out, { requireSignatures: false });
    return structuredClone(out);
  }
}
