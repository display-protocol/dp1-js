import type { ReproBlock, ReproEngineVersion, ReproFrameHash } from './types.js';

function assertHex64(value: string, fieldName: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`dp1: ${fieldName} must be 64 hex chars`);
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
    const out: ReproFrameHash = {
      ...(this.h.sha256 === undefined ? {} : { sha256: String(this.h.sha256) }),
      ...(this.h.phash === undefined ? {} : { phash: String(this.h.phash) }),
    };
    if (out.sha256 !== undefined) assertHex64(out.sha256, 'repro.frameHash.sha256');
    if (out.phash !== undefined && !/^0x[a-f0-9]+$/i.test(out.phash))
      throw new Error('dp1: repro.frameHash.phash must be 0x-prefixed hex');
    return structuredClone(out);
  }
}

export class ReproBuilder {
  private repro: ReproBlock = {};

  engineVersion(value: ReproEngineVersion | EngineVersionBuilder) {
    this.repro.engineVersion = typeof value === 'object' && 'build' in value ? value.build() : value;
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
    this.repro.frameHash = typeof value === 'object' && 'build' in value ? value.build() : value;
    return this;
  }

  build(): ReproBlock {
    const out: ReproBlock = {
      ...(this.repro.engineVersion === undefined ? {} : { engineVersion: this.repro.engineVersion }),
      ...(this.repro.seed === undefined ? {} : { seed: String(this.repro.seed) }),
      ...(this.repro.assetsSHA256 === undefined
        ? {}
        : { assetsSHA256: this.repro.assetsSHA256.map(String) }),
      ...(this.repro.frameHash === undefined ? {} : { frameHash: this.repro.frameHash }),
    };
    if (out.seed !== undefined && !/^0x[a-f0-9]+$/i.test(out.seed))
      throw new Error('dp1: repro.seed must be 0x-prefixed hex');
    if (out.assetsSHA256) out.assetsSHA256.forEach(v => assertHex64(v, 'repro.assetsSHA256[]'));
    return structuredClone(out);
  }
}

