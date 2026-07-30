import { generateId, nowIso, resolve } from './helpers.js';
import type { Controls, Metadata, RefManifest } from './types.js';
import type { ControlsBuilder, MetadataBuilder } from './ref-manifest-blocks.js';
import { RefManifest as ValidateRefManifest } from '../validate/index.js';

export class RefManifestBuilder {
  private doc: Partial<RefManifest> = {};

  refVersion(value: string) {
    this.doc.refVersion = value as RefManifest['refVersion'];
    return this;
  }

  id(value: string) {
    this.doc.id = value;
    return this;
  }

  created(value: string) {
    this.doc.created = value;
    return this;
  }

  locale(value: string) {
    this.doc.locale = value;
    return this;
  }

  metadata(value: Metadata | MetadataBuilder) {
    this.doc.metadata = resolve(value);
    return this;
  }

  controls(value: Controls | ControlsBuilder) {
    this.doc.controls = resolve(value);
    return this;
  }

  i18n(value: Record<string, Metadata>) {
    this.doc.i18n = value;
    return this;
  }

  /** Build a ref-manifest document and schema-validate it (no signatures in schema). */
  build(): RefManifest {
    const out: RefManifest = {
      refVersion: String(this.doc.refVersion ?? '0.1.0') as RefManifest['refVersion'],
      id: this.doc.id ?? generateId(),
      created: this.doc.created ?? nowIso(),
      locale: String(this.doc.locale ?? 'en'),
      ...(this.doc.metadata === undefined ? {} : { metadata: this.doc.metadata }),
      ...(this.doc.controls === undefined ? {} : { controls: this.doc.controls }),
      ...(this.doc.i18n === undefined ? {} : { i18n: this.doc.i18n }),
    };
    ValidateRefManifest(out);
    return structuredClone(out);
  }
}
