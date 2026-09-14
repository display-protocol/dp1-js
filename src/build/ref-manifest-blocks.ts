import { resolve } from './helpers.js';
import type {
  Artist,
  Biography,
  Controls,
  DisplayControls,
  Link,
  LocalizedMetadata,
  Metadata,
  SafetyControls,
  Thumbnail,
} from './types.js';
import type { DisplayControlsBuilder } from './display.js';
import {
  Artist as ValidateArtist,
  Controls as ValidateControls,
  LocalizedMetadata as ValidateLocalizedMetadata,
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
  /**
   * @deprecated Write `.addLink({ type: 'website', url })` instead. Kept so 1.0.0
   * producers still build; the value is emitted as the deprecated `url` field.
   */
  url(value: string) {
    this.a.url = value;
    return this;
  }
  addresses(values: string[]) {
    this.a.addresses = [...values];
    return this;
  }
  addAddress(value: string) {
    if (!this.a.addresses) this.a.addresses = [];
    this.a.addresses.push(value);
    return this;
  }
  avatar(value: Thumbnail | ThumbnailBuilder) {
    this.a.avatar = resolve(value);
    return this;
  }
  biographies(values: Biography[]) {
    this.a.biographies = values.map(v => ({ ...v }));
    return this;
  }
  addBiography(value: Biography) {
    if (!this.a.biographies) this.a.biographies = [];
    this.a.biographies.push({ ...value });
    return this;
  }
  links(values: Link[]) {
    this.a.links = values.map(v => ({ ...v }));
    return this;
  }
  addLink(value: Link) {
    if (!this.a.links) this.a.links = [];
    this.a.links.push({ ...value });
    return this;
  }
  build(): Artist {
    // Spread only what was set, so an untouched optional field stays absent rather than
    // serialising as `undefined` (which JCS would drop but the validator would still see).
    const out: Artist = {
      name: String(this.a.name ?? ''),
      ...(this.a.id === undefined ? {} : { id: String(this.a.id) }),
      ...(this.a.url === undefined ? {} : { url: String(this.a.url) }),
      ...(this.a.addresses === undefined ? {} : { addresses: this.a.addresses }),
      ...(this.a.avatar === undefined ? {} : { avatar: this.a.avatar }),
      ...(this.a.biographies === undefined ? {} : { biographies: this.a.biographies }),
      ...(this.a.links === undefined ? {} : { links: this.a.links }),
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
  /** Add one size-keyed thumbnail (`small`, `large`, `xlarge`, `default`, or any other key). */
  addThumbnail(key: string, value: Thumbnail | ThumbnailBuilder) {
    if (!this.m.thumbnails) this.m.thumbnails = {};
    this.m.thumbnails[key] = resolve(value);
    return this;
  }
  build(): Metadata {
    const out: Metadata = structuredClone(this.m);
    ValidateMetadata(out);
    return out;
  }
}

/**
 * Localized text overrides for one locale, carried under a manifest's `i18n` map.
 * Only `title`, `description`, and `creditLine` are localizable.
 */
export class LocalizedMetadataBuilder {
  private l: LocalizedMetadata = {};
  title(value: string) {
    this.l.title = value;
    return this;
  }
  description(value: string) {
    this.l.description = value;
    return this;
  }
  creditLine(value: string) {
    this.l.creditLine = value;
    return this;
  }
  build(): LocalizedMetadata {
    const out: LocalizedMetadata = structuredClone(this.l);
    ValidateLocalizedMetadata(out);
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
