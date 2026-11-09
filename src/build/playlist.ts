import { generateId, nowIso, resolve } from './helpers.js';
import type {
  Defaults,
  DisplayPrefs,
  DynamicQuery,
  Entity,
  LicenseMode,
  Link,
  Note,
  Playlist,
  PlaylistItem,
  Satellite,
} from './types.js';
import type { DisplayPrefsBuilder } from './display.js';
import type { DynamicQueryBuilder } from './dynamic-query.js';
import type { EntityBuilder } from './entity.js';
import type { NoteBuilder } from './note.js';
import type { PlaylistItemBuilder } from './playlist-item.js';
import {
  Playlist as ValidatePlaylist,
  PlaylistWithContentRatingExtension as ValidatePlaylistWithCrExt,
  PlaylistWithPlaylistsAndContentRatingExtensions as ValidatePlaylistWithExtAndCrExt,
  PlaylistWithPlaylistsExtension as ValidatePlaylistWithExt,
} from '../validate/index.js';

function hasPlaylistsExtensionFields(doc: Playlist): boolean {
  if (
    doc.note !== undefined ||
    doc.curators !== undefined ||
    doc.summary !== undefined ||
    doc.openAt !== undefined ||
    doc.coverImage !== undefined ||
    doc.dynamicQuery !== undefined ||
    doc.links !== undefined ||
    doc.visibility !== undefined ||
    doc.satellites !== undefined
  ) {
    return true;
  }
  return doc.items.some(
    item =>
      item.note !== undefined || item.displayAt !== undefined || item.inlineManifest !== undefined
  );
}

/** True when any item carries a draft content-rating extension field (registry 1.0.7). */
function hasContentRatingFields(doc: Playlist): boolean {
  return doc.items.some(
    item => item.contentRating !== undefined || item.contentReasons !== undefined
  );
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
    openAt?: string;
    coverImage?: string;
    dynamicQuery?: DynamicQuery;
    links?: Link[];
    visibility?: string;
    satellites?: Satellite[];
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

  /**
   * When this playlist's own subject became public — an exhibition's opening, a
   * collection's release (dp1#55). Not §3.5 displayAt Scheduling: sets no eligibility,
   * timer, or activation on items.
   */
  openAt(value: string) {
    this.doc.openAt = value;
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

  /** Editorial content about the playlist — articles, events, news — in display order. */
  links(values: Link[]) {
    this.doc.links = values.map(v => ({ ...v }));
    return this;
  }

  addLink(value: Link) {
    if (!this.doc.links) this.doc.links = [];
    this.doc.links.push({ ...value });
    return this;
  }

  /**
   * Whether directories may list the playlist (§3.7): `'public'` (the default when
   * omitted) or `'unlisted'`. A listing request, not access control.
   */
  visibility(value: string) {
    this.doc.visibility = value;
    return this;
  }

  /**
   * Smaller playlists published around this one — a burn record, a memento run, a
   * catalog or launch-party edition — named here on the parent and rendered as sections
   * of this playlist's page (§3.8).
   */
  satellites(values: Satellite[]) {
    this.doc.satellites = values.map(v => ({ ...v }));
    return this;
  }

  addSatellite(value: Satellite) {
    if (!this.doc.satellites) this.doc.satellites = [];
    this.doc.satellites.push({ ...value });
    return this;
  }

  /**
   * Build an unsigned playlist document and schema-validate it. Picks the narrowest
   * schema the document's fields require: core-only, the playlists extension, the
   * draft content-rating extension, or both extensions composed together (or when
   * `items` is empty, which requires `dynamicQuery` and so always needs the playlists
   * extension's relaxed core bundle).
   */
  build(): Playlist {
    if (this.doc.id === undefined) this.doc.id = generateId();
    if (this.doc.created === undefined) this.doc.created = nowIso();

    const out: Playlist = {
      dpVersion: String(this.doc.dpVersion ?? '1.1.0') as Playlist['dpVersion'],
      title: String(this.doc.title ?? ''),
      items: this.doc.items,
      id: this.doc.id,
      ...(this.doc.slug === undefined ? {} : { slug: this.doc.slug }),
      created: this.doc.created,
      ...(this.doc.defaults === undefined ? {} : { defaults: this.doc.defaults }),
      ...(this.doc.note === undefined ? {} : { note: this.doc.note }),
      ...(this.doc.curators === undefined ? {} : { curators: this.doc.curators }),
      ...(this.doc.summary === undefined ? {} : { summary: this.doc.summary }),
      ...(this.doc.openAt === undefined ? {} : { openAt: this.doc.openAt }),
      ...(this.doc.coverImage === undefined ? {} : { coverImage: this.doc.coverImage }),
      ...(this.doc.dynamicQuery === undefined ? {} : { dynamicQuery: this.doc.dynamicQuery }),
      ...(this.doc.links === undefined ? {} : { links: this.doc.links }),
      ...(this.doc.visibility === undefined ? {} : { visibility: this.doc.visibility }),
      ...(this.doc.satellites === undefined ? {} : { satellites: this.doc.satellites }),
    };

    const needsPlaylistsExt = hasPlaylistsExtensionFields(out) || out.items.length === 0;
    const needsContentRating = hasContentRatingFields(out);

    if (needsPlaylistsExt && needsContentRating) {
      ValidatePlaylistWithExtAndCrExt(out, { requireSignatures: false });
    } else if (needsPlaylistsExt) {
      ValidatePlaylistWithExt(out, { requireSignatures: false });
    } else if (needsContentRating) {
      ValidatePlaylistWithCrExt(out, { requireSignatures: false });
    } else {
      ValidatePlaylist(out, { requireSignatures: false });
    }
    return structuredClone(out);
  }
}
