import { resolve } from './helpers.js';
import type {
  Artist,
  Controls,
  DisplayControls,
  Metadata,
  SafetyControls,
  Thumbnail,
} from './types.js';
import type { DisplayControlsBuilder } from './display.js';
import {
  Artist as ValidateArtist,
  Controls as ValidateControls,
  Metadata as ValidateMetadata,
  SafetyControls as ValidateSafetyControls,
  Thumbnail as ValidateThumbnail,
} from '../validate/index.js';

export class ThumbnailBuilder {
  private t: Partial<Thumbnail> = {};
  uri(value: string) {
    this.t.uri = value;
    return this;
  }
  widthPx(value: number) {
    this.t.w = value;
    return this;
  }
  heightPx(value: number) {
    this.t.h = value;
    return this;
  }
  sha256Hex(value: string) {
    this.t.sha256 = value;
    return this;
  }
  /** `w` / `h` are optional per DP-1: omitted rather than guessed when unset. */
  build(): Thumbnail {
    const out: Thumbnail = {
      uri: String(this.t.uri ?? ''),
      ...(this.t.w === undefined ? {} : { w: this.t.w }),
      ...(this.t.h === undefined ? {} : { h: this.t.h }),
      ...(this.t.sha256 === undefined ? {} : { sha256: String(this.t.sha256) }),
    };
    ValidateThumbnail(out);
    return structuredClone(out);
  }
}

export class ArtistBuilder {
  private a: Partial<Artist> = {};
  name(value: string) {
    this.a.name = value;
    return this;
  }
  id(value: string) {
    this.a.id = value;
    return this;
  }
  url(value: string) {
    this.a.url = value;
    return this;
  }
  build(): Artist {
    const out: Artist = {
      name: String(this.a.name ?? ''),
      ...(this.a.id === undefined ? {} : { id: String(this.a.id) }),
      ...(this.a.url === undefined ? {} : { url: String(this.a.url) }),
    };
    ValidateArtist(out);
    return structuredClone(out);
  }
}

export class MetadataBuilder {
  private m: Metadata = {};
  title(value: string) {
    this.m.title = value;
    return this;
  }
  creditLine(value: string) {
    this.m.creditLine = value;
    return this;
  }
  description(value: string) {
    this.m.description = value;
    return this;
  }
  tags(values: string[]) {
    this.m.tags = values;
    return this;
  }
  artists(values: Array<Artist | ArtistBuilder>) {
    this.m.artists = values.map(v => resolve(v));
    return this;
  }
  addArtist(value: Artist | ArtistBuilder) {
    if (!this.m.artists) this.m.artists = [];
    this.m.artists.push(resolve(value));
    return this;
  }
  thumbnails(values: Record<string, Thumbnail | ThumbnailBuilder>) {
    const out: Record<string, Thumbnail> = {};
    for (const [k, v] of Object.entries(values)) {
      out[k] = resolve(v);
    }
    this.m.thumbnails = out;
    return this;
  }
  build(): Metadata {
    const out: Metadata = structuredClone(this.m);
    ValidateMetadata(out);
    return out;
  }
}

export class SafetyControlsBuilder {
  private s: SafetyControls = {};
  orientation(values: Array<'landscape' | 'portrait' | 'any'>) {
    this.s.orientation = values;
    return this;
  }
  maxCpuPct(value: number) {
    this.s.maxCpuPct = value;
    return this;
  }
  maxMemMB(value: number) {
    this.s.maxMemMB = value;
    return this;
  }
  build(): SafetyControls {
    const out: SafetyControls = structuredClone(this.s);
    ValidateSafetyControls(out);
    return out;
  }
}

export class ControlsBuilder {
  private c: Controls = {};

  display(value: DisplayControls | DisplayControlsBuilder) {
    this.c.display = resolve(value);
    return this;
  }

  safety(value: SafetyControls | SafetyControlsBuilder) {
    this.c.safety = resolve(value);
    return this;
  }

  build(): Controls {
    const out: Controls = structuredClone(this.c);
    ValidateControls(out);
    return out;
  }
}
