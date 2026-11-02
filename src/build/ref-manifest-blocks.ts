import { resolve } from './helpers.js';
import type {
  Controls,
  DisplayControls,
  Medium,
  MediumType,
  Metadata,
  LocalizedMetadata,
  Permission,
  SafetyControls,
  Thumbnail,
} from './types.js';
import type { DisplayControlsBuilder } from './display.js';
import { EntityBuilder } from './entity.js';
import type { Artist } from './types.js';
import {
  Controls as ValidateControls,
  LocalizedMetadata as ValidateLocalizedMetadata,
  Medium as ValidateMedium,
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

/**
 * Builds an `Artist` — an alias of `EntityBuilder`, since `Artist` is now the shared
 * `Entity` on the wire (dp1 registry 1.0.9 Entity consolidation; the core schema's own
 * `Artist` is a `$ref` to `Entity`). Kept under this name so existing call sites and
 * `metadata.artists[]` usage read naturally; `ArtistBuilder` and `EntityBuilder` build
 * byte-identical output and validate against the same schema.
 */
export const ArtistBuilder = EntityBuilder;
export type ArtistBuilder = EntityBuilder;

/** What the work is made of (spec §4.1, refVersion 1.2.0): a catalog-filterable `type`
 * plus the display `details` lines shown under the title. */
export class MediumBuilder {
  private m: Medium = {};
  type(value: MediumType) {
    this.m.type = value;
    return this;
  }
  details(values: string[]) {
    this.m.details = [...values];
    return this;
  }
  addDetail(value: string) {
    if (!this.m.details) this.m.details = [];
    this.m.details.push(value);
    return this;
  }
  build(): Medium {
    const out: Medium = structuredClone(this.m);
    ValidateMedium(out);
    return out;
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
  medium(value: Medium | MediumBuilder) {
    this.m.medium = resolve(value);
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

  /** Device capabilities the work needs to run as intended (`'camera'`, `'microphone'`). */
  permissions(values: Permission[]) {
    this.c.permissions = [...values];
    return this;
  }

  addPermission(value: Permission) {
    if (!this.c.permissions) this.c.permissions = [];
    this.c.permissions.push(value);
    return this;
  }

  build(): Controls {
    const out: Controls = structuredClone(this.c);
    ValidateControls(out);
    return out;
  }
}
