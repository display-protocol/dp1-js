import { assertHex64, assertUri, resolve } from './helpers.js';
import type {
  Artist,
  Controls,
  DisplayControls,
  Metadata,
  SafetyControls,
  Thumbnail,
} from './types.js';
import { DisplayControlsBuilder, validateDisplayCommon } from './display.js';

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
  build(): Thumbnail {
    const out: Thumbnail = {
      uri: String(this.t.uri ?? ''),
      w: Number(this.t.w),
      h: Number(this.t.h),
      ...(this.t.sha256 === undefined ? {} : { sha256: String(this.t.sha256) }),
    };
    assertUri(out.uri, 'thumbnail.uri');
    if (!Number.isInteger(out.w) || out.w < 1) throw new Error('dp1: thumbnail.w must be >= 1');
    if (!Number.isInteger(out.h) || out.h < 1) throw new Error('dp1: thumbnail.h must be >= 1');
    if (out.sha256 !== undefined) out.sha256 = assertHex64(out.sha256, 'thumbnail.sha256');
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
    if (!out.name.trim()) throw new Error('dp1: artist.name must be a non-empty string');
    if (out.url !== undefined) assertUri(out.url, 'artist.url');
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
    if (out.thumbnails) {
      for (const [k, v] of Object.entries(out.thumbnails)) {
        if (!k) throw new Error('dp1: thumbnails keys must be non-empty');
        const tb = new ThumbnailBuilder().uri(v.uri).widthPx(v.w).heightPx(v.h);
        if (v.sha256 !== undefined) tb.sha256Hex(v.sha256);
        out.thumbnails[k] = tb.build();
      }
    }
    if (out.artists) {
      out.artists = out.artists.map(a => {
        const ab = new ArtistBuilder().name(a.name);
        if (a.id !== undefined) ab.id(a.id);
        if (a.url !== undefined) ab.url(a.url);
        return ab.build();
      });
    }
    return structuredClone(out);
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
    if (out.orientation) {
      for (const v of out.orientation) {
        if (!['landscape', 'portrait', 'any'].includes(v))
          throw new Error('dp1: safety.orientation must be landscape|portrait|any');
      }
    }
    if (out.maxCpuPct !== undefined) {
      if (!Number.isInteger(out.maxCpuPct) || out.maxCpuPct < 1 || out.maxCpuPct > 100)
        throw new Error('dp1: safety.maxCpuPct must be an integer 1..100');
    }
    if (out.maxMemMB !== undefined) {
      if (!Number.isInteger(out.maxMemMB) || out.maxMemMB < 1)
        throw new Error('dp1: safety.maxMemMB must be an integer >= 1');
    }
    return structuredClone(out);
  }
}

function validateDisplayControls(display: DisplayControls): DisplayControls {
  const db = new DisplayControlsBuilder();
  if (display.scaling !== undefined) db.scaling(display.scaling);
  if (display.margin !== undefined) db.margin(display.margin);
  if (display.background !== undefined) db.background(display.background);
  if (display.autoplay !== undefined) db.autoplay(display.autoplay);
  if (display.loop !== undefined) db.loop(display.loop);
  if (display.interaction !== undefined) db.interaction(display.interaction);
  // Also run shared checks in case fields were partially omitted from builder path.
  validateDisplayCommon(display, 'controls.display');
  return db.build();
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
    if (out.display) out.display = validateDisplayControls(out.display);
    if (out.safety) {
      const sb = new SafetyControlsBuilder();
      if (out.safety.orientation) sb.orientation(out.safety.orientation);
      if (out.safety.maxCpuPct !== undefined) sb.maxCpuPct(out.safety.maxCpuPct);
      if (out.safety.maxMemMB !== undefined) sb.maxMemMB(out.safety.maxMemMB);
      out.safety = sb.build();
    }
    return structuredClone(out);
  }
}
