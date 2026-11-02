import { generateId, nowIso, resolve } from './helpers.js';
import type {
  Controls,
  Entity,
  Link,
  LocalizedMetadataOverride,
  Metadata,
  RefManifest,
} from './types.js';
import type {
  ControlsBuilder,
  LocalizedMetadataBuilder,
  MetadataBuilder,
} from './ref-manifest-blocks.js';
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

  /**
   * Localized text overrides keyed by locale. Values are `LocalizedMetadata`
   * (title / description / creditLine), not a full `Metadata` block.
   */
  i18n(values: Record<string, LocalizedMetadataOverride | LocalizedMetadataBuilder>) {
    const out: Record<string, LocalizedMetadataOverride> = {};
    for (const [locale, value] of Object.entries(values)) {
      out[locale] = resolve(value);
    }
    this.doc.i18n = out;
    return this;
  }

  addLocalized(locale: string, value: LocalizedMetadataOverride | LocalizedMetadataBuilder) {
    if (!this.doc.i18n) this.doc.i18n = {};
    this.doc.i18n[locale] = resolve(value);
    return this;
  }

  /** Build a ref-manifest document and schema-validate it (no signatures in schema). */
  build(): RefManifest {
    if (this.doc.id === undefined) this.doc.id = generateId();
    if (this.doc.created === undefined) this.doc.created = nowIso();

    // An unset version follows the fields the document carries: artist profile fields exist
    // only from refVersion 1.1.0, and medium / permissions / imageRendering only from 1.2.0
    // (spec §4.1), so the default follows suit — highest first, since a 1.2.0 feature implies
    // the 1.1.0 ones are also fine to carry. An explicit `.refVersion()` still wins; the SDK
    // validates shape only and does not police the pairing.
    const defaultVersion = has12Features(this.doc)
      ? '1.2.0'
      : hasArtistProfile(this.doc.metadata)
        ? '1.1.0'
        : '0.1.0';

    const out: RefManifest = {
      refVersion: String(this.doc.refVersion ?? defaultVersion) as RefManifest['refVersion'],
      id: this.doc.id,
      created: this.doc.created,
      locale: String(this.doc.locale ?? 'en'),
      ...(this.doc.metadata === undefined ? {} : { metadata: this.doc.metadata }),
      ...(this.doc.controls === undefined ? {} : { controls: this.doc.controls }),
      ...(this.doc.i18n === undefined ? {} : { i18n: this.doc.i18n }),
    };
    ValidateRefManifest(out);
    return structuredClone(out);
  }
}

/** True when any artist carries a refVersion 1.1.0 profile field (spec §4.1). */
function hasArtistProfile(metadata: Metadata | undefined): boolean {
  return (metadata?.artists ?? []).some(
    a =>
      a.addresses !== undefined ||
      a.avatar !== undefined ||
      a.biographies !== undefined ||
      a.links !== undefined
  );
}

/** `Link.type` values added at refVersion 1.2.0 alongside the Entity consolidation
 * (spec §4.2, §12). */
const LINK_TYPES_1_2_0 = new Set<Link['type']>([
  'profile',
  'publication',
  'article',
  'event',
  'news',
]);

/** True when a `Link` carries a refVersion 1.2.0 addition: one of the new `type`
 * values, or `title` / `date` / `thumbnail` / `authors` (spec §4.2). */
function hasLink12Features(link: Link): boolean {
  return (
    LINK_TYPES_1_2_0.has(link.type) ||
    link.title !== undefined ||
    link.date !== undefined ||
    link.thumbnail !== undefined ||
    link.authors !== undefined
  );
}

/** True when an artist `Entity` carries a refVersion 1.2.0 field: `key`, `role`,
 * `location`, or a `links` entry with a 1.2.0 addition (spec §4.2). */
function hasEntity12Features(entity: Entity): boolean {
  return (
    entity.key !== undefined ||
    entity.role !== undefined ||
    entity.location !== undefined ||
    (entity.links ?? []).some(hasLink12Features)
  );
}

/** True when the document carries a refVersion 1.2.0 field (spec §4.1, §4.2):
 * `metadata.medium`, `controls.permissions`, `controls.display.imageRendering`, or an
 * artist entity/link carrying a 1.2.0 Entity-consolidation addition. */
function has12Features(doc: Partial<RefManifest>): boolean {
  return (
    doc.metadata?.medium !== undefined ||
    doc.controls?.permissions !== undefined ||
    doc.controls?.display?.imageRendering !== undefined ||
    (doc.metadata?.artists ?? []).some(hasEntity12Features)
  );
}
