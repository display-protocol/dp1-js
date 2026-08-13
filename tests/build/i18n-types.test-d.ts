// Type-level regression test. There is nothing to execute: the assertions are the
// `@ts-expect-error` comments, which `npm run type-check` enforces because tsconfig
// includes `tests/**/*`. A `@ts-expect-error` that stops erroring is itself an error,
// so this file fails the build if the guard on `i18n` values is ever weakened.
//
// Guarding matters because `LocalizedMetadata`'s fields are all optional, which makes
// `Metadata` structurally assignable to it. TypeScript's excess-property check fires
// only on fresh object literals, so without `LocalizedMetadataOverride`'s `never`
// fields every case below would compile silently.

import type {
  LocalizedMetadata,
  LocalizedMetadataOverride,
  Metadata,
  RefManifest,
} from '../../src/build/types.js';
import { LocalizedMetadataBuilder, MetadataBuilder } from '../../src/build/ref-manifest-blocks.js';
import { RefManifestBuilder } from '../../src/build/ref-manifest.js';

const full: Metadata = { title: 'T', artists: [{ name: 'Ada' }], tags: ['x'] };
const localized: LocalizedMetadata = { title: 'T', description: 'D', creditLine: 'C' };

// --- Rejected: a full Metadata value where a locale override belongs ---

// @ts-expect-error Metadata carries artists/tags/thumbnails, which are not localizable.
new RefManifestBuilder().i18n({ fr: full });

// @ts-expect-error Same guard on the single-locale setter.
new RefManifestBuilder().addLocalized('fr', full);

// Same guard when assembling a RefManifest by hand. The directive sits on the offending
// property, since `@ts-expect-error` only covers the line immediately after it.
const byHand: RefManifest = {
  refVersion: '0.1.0',
  id: 'r',
  created: '2025-01-01T00:00:00Z',
  locale: 'en',
  // @ts-expect-error Metadata is not a locale override.
  i18n: { fr: full },
};
void byHand;

// @ts-expect-error A fresh literal carrying a non-localizable field is rejected too.
new RefManifestBuilder().i18n({ fr: { title: 'T', artists: [{ name: 'Ada' }] } });

// @ts-expect-error A built Metadata block is not a locale override either.
new RefManifestBuilder().addLocalized('fr', new MetadataBuilder().title('T').build());

// --- Accepted: the shapes the schema actually localizes ---

new RefManifestBuilder().i18n({ fr: localized });
new RefManifestBuilder().i18n({ fr: { title: 'Œuvre', creditLine: 'Crédit' } });
new RefManifestBuilder().addLocalized('vi', localized);
new RefManifestBuilder().addLocalized('vi', new LocalizedMetadataBuilder().title('Tác phẩm'));

// A plain LocalizedMetadata still satisfies the guarded type: the `never` fields are
// optional, so a value that simply lacks them is assignable.
const asOverride: LocalizedMetadataOverride = localized;
void asOverride;

// Reading back stays ergonomic — a guarded value is usable as the plain model.
declare const manifest: RefManifest;
const readBack: LocalizedMetadata | undefined = manifest.i18n?.fr;
void readBack;
