import { resolve } from './helpers.js';
import type { ReproBlock, ReproEngineVersion, ReproFrameHash } from './types.js';
import {
  ReproBlock as ValidateReproBlock,
  ReproEngineVersion as ValidateReproEngineVersion,
  ReproFrameHash as ValidateReproFrameHash,
} from '../validate/index.js';

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
    const out = structuredClone({
      ...(this.v.chromium === undefined ? {} : { chromium: String(this.v.chromium) }),
      ...(this.v.webkit === undefined ? {} : { webkit: String(this.v.webkit) }),
      ...(this.v.gecko === undefined ? {} : { gecko: String(this.v.gecko) }),
    });
    ValidateReproEngineVersion(out);
    return out;
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
    ValidateReproFrameHash(out);
    return structuredClone(out);
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
      ...(this.repro.frameHash === undefined ? {} : { frameHash: this.repro.frameHash }),
    };
    ValidateReproBlock(out);
    return structuredClone(out);
  }
}
