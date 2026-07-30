import { assert0xHex, assertHex64, resolve } from './helpers.js';
import type { ReproBlock, ReproEngineVersion, ReproFrameHash } from './types.js';

function validateFrameHash(h: ReproFrameHash): ReproFrameHash {
  const out: ReproFrameHash = {
    ...(h.sha256 === undefined ? {} : { sha256: String(h.sha256) }),
    ...(h.phash === undefined ? {} : { phash: String(h.phash) }),
  };
  if (out.sha256 !== undefined) out.sha256 = assertHex64(out.sha256, 'repro.frameHash.sha256');
  if (out.phash !== undefined) out.phash = assert0xHex(out.phash, 'repro.frameHash.phash');
  return structuredClone(out);
}

export class EngineVersionBuilder {
  private v: ReproEngineVersion = {};
  chromium(value: string) {
    this.v.chromium = value;
    return this;
  }
  webkit(value: string) {
    this.v.webkit = value;
    return this;
  }
  gecko(value: string) {
    this.v.gecko = value;
    return this;
  }
  build(): ReproEngineVersion {
    return structuredClone({
      ...(this.v.chromium === undefined ? {} : { chromium: String(this.v.chromium) }),
      ...(this.v.webkit === undefined ? {} : { webkit: String(this.v.webkit) }),
      ...(this.v.gecko === undefined ? {} : { gecko: String(this.v.gecko) }),
    });
  }
}

export class FrameHashBuilder {
  private h: ReproFrameHash = {};
  sha256Hex(value: string) {
    this.h.sha256 = value;
    return this;
  }
  phashHex(value: string) {
    this.h.phash = value;
    return this;
  }
  build(): ReproFrameHash {
    return validateFrameHash(this.h);
  }
}

export class ReproBuilder {
  private repro: ReproBlock = {};

  engineVersion(value: ReproEngineVersion | EngineVersionBuilder) {
    this.repro.engineVersion = resolve(value);
    return this;
  }

  seedHex(value: string) {
    this.repro.seed = value;
    return this;
  }

  assetsSha256Hex(values: string[]) {
    this.repro.assetsSHA256 = values;
    return this;
  }

  frameHash(value: ReproFrameHash | FrameHashBuilder) {
    this.repro.frameHash = resolve(value);
    return this;
  }

  build(): ReproBlock {
    const out: ReproBlock = {
      ...(this.repro.engineVersion === undefined
        ? {}
        : { engineVersion: this.repro.engineVersion }),
      ...(this.repro.seed === undefined ? {} : { seed: String(this.repro.seed) }),
      ...(this.repro.assetsSHA256 === undefined
        ? {}
        : { assetsSHA256: this.repro.assetsSHA256.map(String) }),
      ...(this.repro.frameHash === undefined
        ? {}
        : { frameHash: validateFrameHash(this.repro.frameHash) }),
    };
    if (out.seed !== undefined) out.seed = assert0xHex(out.seed, 'repro.seed');
    if (out.assetsSHA256) {
      out.assetsSHA256 = out.assetsSHA256.map(v => assertHex64(v, 'repro.assetsSHA256[]'));
    }
    return structuredClone(out);
  }
}
