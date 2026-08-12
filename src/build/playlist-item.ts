import { resolve } from './helpers.js';
import type {
  DisplayPrefs,
  LicenseMode,
  Note,
  PlaylistItem,
  ProvenanceBlock,
  RefManifest,
  ReproBlock,
} from './types.js';
import type { DisplayPrefsBuilder } from './display.js';
import type { NoteBuilder } from './note.js';
import type { ProvenanceBuilder } from './provenance.js';
import type { RefManifestBuilder } from './ref-manifest.js';
import type { ReproBuilder } from './repro.js';
import {
  PlaylistItem as ValidatePlaylistItem,
  PlaylistItemWithPlaylistsExtension as ValidatePlaylistItemWithExt,
  RefManifest as ValidateRefManifest,
} from '../validate/index.js';

export class PlaylistItemBuilder {
  private item: Partial<PlaylistItem> = {};

  id(value: string) {
    this.item.id = value;
    return this;
  }

  slug(value: string) {
    this.item.slug = value;
    return this;
  }

  title(value: string) {
    this.item.title = value;
    return this;
  }

  source(value: string) {
    this.item.source = value;
    return this;
  }

  durationSeconds(value: number) {
    this.item.duration = value;
    return this;
  }

  license(value: LicenseMode) {
    this.item.license = value;
    return this;
  }

  ref(value: string) {
    this.item.ref = value;
    return this;
  }

  override(value: Record<string, unknown>) {
    this.item.override = value;
    return this;
  }

  display(value: DisplayPrefs | DisplayPrefsBuilder) {
    this.item.display = resolve(value);
    return this;
  }

  repro(value: ReproBlock | ReproBuilder) {
    this.item.repro = resolve(value);
    return this;
  }

  provenance(value: ProvenanceBlock | ProvenanceBuilder) {
    this.item.provenance = resolve(value);
    return this;
  }

  note(value: Note | NoteBuilder) {
    this.item.note = resolve(value);
    return this;
  }

  displayAt(value: string) {
    this.item.displayAt = value;
    return this;
  }

  /**
   * Carry a full Ref Manifest on the item instead of behind `ref` (playlists extension §3.6).
   * When both are set, a consumer resolves `ref` first — this library keeps both as given.
   */
  inlineManifest(value: RefManifest | RefManifestBuilder) {
    this.item.inlineManifest = resolve(value);
    return this;
  }

  build(): PlaylistItem {
    const out: PlaylistItem = {
      source: String(this.item.source ?? ''),
      ...(this.item.id === undefined ? {} : { id: this.item.id }),
      ...(this.item.slug === undefined ? {} : { slug: this.item.slug }),
      ...(this.item.title === undefined ? {} : { title: this.item.title }),
      ...(this.item.duration === undefined ? {} : { duration: this.item.duration }),
      ...(this.item.license === undefined ? {} : { license: this.item.license }),
      ...(this.item.ref === undefined ? {} : { ref: this.item.ref }),
      ...(this.item.override === undefined ? {} : { override: this.item.override }),
      ...(this.item.display === undefined ? {} : { display: this.item.display }),
      ...(this.item.repro === undefined ? {} : { repro: this.item.repro }),
      ...(this.item.provenance === undefined ? {} : { provenance: this.item.provenance }),
      ...(this.item.note === undefined ? {} : { note: this.item.note }),
      ...(this.item.displayAt === undefined ? {} : { displayAt: this.item.displayAt }),
      ...(this.item.inlineManifest === undefined
        ? {}
        : { inlineManifest: this.item.inlineManifest }),
    };

    if (out.note !== undefined || out.displayAt !== undefined) {
      ValidatePlaylistItemWithExt(out);
    } else {
      ValidatePlaylistItem(out);
    }
    // The composed single-item schema mirrors the spec file, which carries no
    // `inlineManifest`, so validate the nested manifest against the core schema here.
    if (out.inlineManifest !== undefined) ValidateRefManifest(out.inlineManifest);
    return structuredClone(out);
  }
}
