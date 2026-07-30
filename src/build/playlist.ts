import { generateId, nowIso, resolve } from './helpers.js';
import type {
  Defaults,
  DisplayPrefs,
  DynamicQuery,
  Entity,
  LicenseMode,
  Note,
  Playlist,
  PlaylistItem,
} from './types.js';
import type { DisplayPrefsBuilder } from './display.js';
import type { DynamicQueryBuilder } from './dynamic-query.js';
import type { EntityBuilder } from './entity.js';
import type { NoteBuilder } from './note.js';
import type { PlaylistItemBuilder } from './playlist-item.js';
import {
  Playlist as ValidatePlaylist,
  PlaylistWithPlaylistsExtension as ValidatePlaylistWithExt,
} from '../validate/index.js';

function hasPlaylistsExtensionFields(doc: Playlist): boolean {
  if (
    doc.note !== undefined ||
    doc.curators !== undefined ||
    doc.summary !== undefined ||
    doc.coverImage !== undefined ||
    doc.dynamicQuery !== undefined
  ) {
    return true;
  }
  return doc.items.some(item => item.note !== undefined || item.displayAt !== undefined);
}

export class PlaylistBuilder {
  private doc: {
    dpVersion?: string;
    id?: string;
    title?: string;
    slug?: string;
    created?: string;
    defaults?: Defaults;
    items: PlaylistItem[];
    note?: Note;
    curators?: Entity[];
    summary?: string;
    coverImage?: string;
    dynamicQuery?: DynamicQuery;
  } = { items: [] };

  dpVersion(value: string) {
    this.doc.dpVersion = value;
    return this;
  }

  id(value: string) {
    this.doc.id = value;
    return this;
  }

  title(value: string) {
    this.doc.title = value;
    return this;
  }

  slug(value: string) {
    this.doc.slug = value;
    return this;
  }

  created(value: string) {
    this.doc.created = value;
    return this;
  }

  defaults(value: Defaults) {
    this.doc.defaults = value;
    return this;
  }

  defaultDisplay(value: DisplayPrefs | DisplayPrefsBuilder) {
    if (!this.doc.defaults) this.doc.defaults = {};
    this.doc.defaults.display = resolve(value);
    return this;
  }

  defaultLicense(value: LicenseMode) {
    if (!this.doc.defaults) this.doc.defaults = {};
    this.doc.defaults.license = value;
    return this;
  }

  defaultDurationSeconds(value: number) {
    if (!this.doc.defaults) this.doc.defaults = {};
    this.doc.defaults.duration = value;
    return this;
  }

  addItem(value: PlaylistItem | PlaylistItemBuilder) {
    this.doc.items.push(resolve(value));
    return this;
  }

  items(values: Array<PlaylistItem | PlaylistItemBuilder>) {
    this.doc.items = values.map(v => resolve(v));
    return this;
  }

  note(value: Note | NoteBuilder) {
    this.doc.note = resolve(value);
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

  summary(value: string) {
    this.doc.summary = value;
    return this;
  }

  coverImage(value: string) {
    this.doc.coverImage = value;
    return this;
  }

  dynamicQuery(value: DynamicQuery | DynamicQueryBuilder) {
    this.doc.dynamicQuery = resolve(value);
    return this;
  }

  /**
   * Build an unsigned playlist document and schema-validate it.
   * Uses the playlists-extension composed schema when extension fields are present
   * (or when `items` is empty, which requires `dynamicQuery`).
   */
  build(): Playlist {
    const out: Playlist = {
      dpVersion: String(this.doc.dpVersion ?? '1.1.0') as Playlist['dpVersion'],
      title: String(this.doc.title ?? ''),
      items: this.doc.items,
      id: this.doc.id ?? generateId(),
      ...(this.doc.slug === undefined ? {} : { slug: this.doc.slug }),
      created: this.doc.created ?? nowIso(),
      ...(this.doc.defaults === undefined ? {} : { defaults: this.doc.defaults }),
      ...(this.doc.note === undefined ? {} : { note: this.doc.note }),
      ...(this.doc.curators === undefined ? {} : { curators: this.doc.curators }),
      ...(this.doc.summary === undefined ? {} : { summary: this.doc.summary }),
      ...(this.doc.coverImage === undefined ? {} : { coverImage: this.doc.coverImage }),
      ...(this.doc.dynamicQuery === undefined ? {} : { dynamicQuery: this.doc.dynamicQuery }),
    };

    if (hasPlaylistsExtensionFields(out) || out.items.length === 0) {
      ValidatePlaylistWithExt(out, { requireSignatures: false });
    } else {
      ValidatePlaylist(out, { requireSignatures: false });
    }
    return structuredClone(out);
  }
}
