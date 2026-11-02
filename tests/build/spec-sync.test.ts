// Coverage for the dp1 registry 1.0.9 / 1.0.8 / 1.0.7 spec sync (Entity consolidation, medium,
// permissions, imageRendering, decimal seriesId, playlist openAt/links/visibility, Note
// title/author, and the draft content-rating extension). Pinned to dp1 commit bef4083.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  ChannelBuilder,
  ContractBuilder,
  ControlsBuilder,
  DisplayControlsBuilder,
  DisplayPrefsBuilder,
  EntityBuilder,
  MediumBuilder,
  MetadataBuilder,
  NoteBuilder,
  PlaylistBuilder,
  PlaylistItemBuilder,
  RefManifestBuilder,
} from '../../src/build/index.js';
import {
  ContentRatingGeneral,
  ContentRatingMature,
  isKnownContentRating,
  ValidateContentRatingExtensionFragment,
  ValidatePlaylistItemWithContentRatingExtension,
  ValidatePlaylistWithContentRatingExtension,
  ValidatePlaylistWithPlaylistsAndContentRatingExtensions,
} from '../../src/extension/content-rating/index.js';
import { DisplayForItem } from '../../src/merge/index.js';
import { ErrValidation } from '../../src/errors.js';

function isValidationError(err: unknown): boolean {
  return err instanceof Error && err.cause === ErrValidation;
}

test('EntityBuilder carries role, location and no longer requires key', () => {
  const entity = new EntityBuilder()
    .name('Gallery Co')
    .role('partner')
    .location('Berlin, Germany')
    .addresses(['0xabc'])
    .build();
  assert.equal(entity.role, 'partner');
  assert.equal(entity.location, 'Berlin, Germany');
  assert.equal(entity.key, undefined);

  assert.throws(
    () =>
      new EntityBuilder()
        .name('X')
        .role('nonsense' as 'other')
        .build(),
    isValidationError
  );
});

test('Link gains the editorial type values and title/date/thumbnail/authors', () => {
  const link = {
    type: 'article' as const,
    url: 'https://news.example/piece',
    title: 'A piece about the work',
    date: '2026-01-01T00:00:00Z',
    thumbnail: { uri: 'https://news.example/cover.jpg' },
    authors: [{ name: 'A Writer' }],
  };
  const playlist = new PlaylistBuilder()
    .title('T')
    .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
    .addLink(link)
    .build();
  assert.equal(playlist.links?.[0]?.title, 'A piece about the work');
  assert.equal(playlist.links?.[0]?.authors?.[0]?.name, 'A Writer');
});

test('MediumBuilder validates type and details', () => {
  const medium = new MediumBuilder().type('video').addDetail('HD, color, sound').build();
  assert.equal(medium.type, 'video');
  assert.deepEqual(medium.details, ['HD, color, sound']);

  assert.throws(() => new MediumBuilder().type('hologram' as 'video').build(), isValidationError);

  const meta = new MetadataBuilder().title('T').medium(medium).build();
  assert.equal(meta.medium?.type, 'video');
});

test('ControlsBuilder validates permissions', () => {
  const controls = new ControlsBuilder()
    .addPermission('camera')
    .addPermission('microphone')
    .build();
  assert.deepEqual(controls.permissions, ['camera', 'microphone']);

  assert.throws(
    () => new ControlsBuilder().permissions(['camera', 'camera']).build(),
    isValidationError
  );
  assert.throws(
    () => new ControlsBuilder().permissions(['bluetooth' as 'camera']).build(),
    isValidationError
  );
});

test('DisplayPrefsBuilder and DisplayControlsBuilder validate imageRendering', () => {
  const prefs = new DisplayPrefsBuilder().imageRendering('pixelated').build();
  assert.equal(prefs.imageRendering, 'pixelated');
  const controls = new DisplayControlsBuilder().imageRendering('auto').build();
  assert.equal(controls.imageRendering, 'auto');
  assert.throws(
    () => new DisplayPrefsBuilder().imageRendering('smooth' as 'auto').build(),
    isValidationError
  );
});

test('ContractBuilder accepts a decimal-string seriesId for ids too large for a number', () => {
  const big = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
  const contract = new ContractBuilder().chain('evm').seriesId(big).build();
  assert.equal(contract.seriesId, big);

  const small = new ContractBuilder().chain('evm').seriesId(7).build();
  assert.equal(small.seriesId, 7);

  assert.throws(
    () => new ContractBuilder().chain('evm').seriesId('5.5').build(),
    isValidationError
  );
});

test('PlaylistBuilder carries openAt and visibility', () => {
  const playlist = new PlaylistBuilder()
    .title('T')
    .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
    .openAt('2026-03-01T00:00:00')
    .visibility('unlisted')
    .build();
  assert.equal(playlist.openAt, '2026-03-01T00:00:00');
  assert.equal(playlist.visibility, 'unlisted');
});

test('NoteBuilder carries title and author', () => {
  const note = new NoteBuilder()
    .text('A short interlude')
    .title('Intermission')
    .author({
      name: 'Curator',
    })
    .build();
  assert.equal(note.title, 'Intermission');
  assert.equal(note.author?.name, 'Curator');
});

test('PlaylistItemBuilder carries contentRating and contentReasons', () => {
  const item = new PlaylistItemBuilder()
    .source('https://example.com/a.html')
    .contentRating('mature')
    .addContentReason('nudity')
    .build();
  assert.equal(item.contentRating, 'mature');
  assert.deepEqual(item.contentReasons, ['nudity']);
});

test('PlaylistBuilder routes to the content-rating composed schema when items carry it', () => {
  const withCrOnly = new PlaylistBuilder()
    .title('T')
    .addItem(
      new PlaylistItemBuilder().source('https://example.com/a.html').contentRating('general')
    )
    .build();
  assert.equal(withCrOnly.items[0]?.contentRating, 'general');

  // Both draft extensions at once (playlists-extension openAt + content-rating item).
  const withBoth = new PlaylistBuilder()
    .title('T')
    .openAt('2026-01-01T00:00:00')
    .addItem(
      new PlaylistItemBuilder()
        .source('https://example.com/a.html')
        .displayAt('2026-01-01T00:00:00')
        .contentRating('mature')
    )
    .build();
  assert.equal(withBoth.items[0]?.contentRating, 'mature');
  assert.equal(withBoth.openAt, '2026-01-01T00:00:00');
});

test('content-rating vocabulary is open: unknown ratings validate and round-trip', () => {
  ValidatePlaylistItemWithContentRatingExtension({
    source: 'https://example.com/a.html',
    contentRating: 'from-a-later-vocabulary',
  });
  assert.equal(isKnownContentRating(ContentRatingGeneral), true);
  assert.equal(isKnownContentRating(ContentRatingMature), true);
  assert.equal(isKnownContentRating('from-a-later-vocabulary'), false);
  assert.equal(isKnownContentRating(undefined), false);

  // null / non-string values are schema-invalid, never "unrated".
  assert.throws(
    () =>
      ValidatePlaylistItemWithContentRatingExtension({
        source: 'https://example.com/a.html',
        contentRating: null,
      }),
    isValidationError
  );
});

test('ContentRatingExtensionFragment validates the items-only fragment alone', () => {
  ValidateContentRatingExtensionFragment({
    items: [{ contentRating: 'mature', contentReasons: ['violence'] }],
  });
  assert.throws(
    () => ValidateContentRatingExtensionFragment({ items: [{ contentReasons: [''] }] }),
    isValidationError
  );
});

test('PlaylistWithContentRatingExtension and the combined playlists+content-rating schema', () => {
  const base = {
    dpVersion: '1.1.0' as const,
    id: '11111111-1111-4111-8111-111111111111',
    title: 'T',
    created: '2026-01-01T00:00:00Z',
    items: [{ source: 'https://example.com/a.html', contentRating: 'mature' }],
  };
  ValidatePlaylistWithContentRatingExtension(base, { requireSignatures: false });
  ValidatePlaylistWithPlaylistsAndContentRatingExtensions(
    { ...base, visibility: 'unlisted' },
    { requireSignatures: false }
  );
});

test('ChannelBuilder accepts a curator with no key and the new Entity fields', () => {
  const channel = new ChannelBuilder()
    .slug('s')
    .title('T')
    .addPlaylist('https://example.com/p.json')
    .addCurator(new EntityBuilder().name('Cur').role('curator').location('NYC'))
    .publisher(new EntityBuilder().name('Pub'))
    .build();
  assert.equal(channel.curators?.[0]?.location, 'NYC');
  assert.equal(channel.publisher?.key, undefined);
});

test('RefManifestBuilder defaults refVersion to 1.2.0 when medium/permissions/imageRendering are used', () => {
  const withMedium = new RefManifestBuilder()
    .locale('en')
    .metadata(new MetadataBuilder().title('T').medium(new MediumBuilder().type('video')))
    .build();
  assert.equal(withMedium.refVersion, '1.2.0');

  const withPermissions = new RefManifestBuilder()
    .locale('en')
    .controls(new ControlsBuilder().addPermission('camera'))
    .build();
  assert.equal(withPermissions.refVersion, '1.2.0');

  const withImageRendering = new RefManifestBuilder()
    .locale('en')
    .controls(new ControlsBuilder().display(new DisplayControlsBuilder().imageRendering('auto')))
    .build();
  assert.equal(withImageRendering.refVersion, '1.2.0');

  const plain = new RefManifestBuilder().locale('en').build();
  assert.equal(plain.refVersion, '0.1.0');
});

test('DisplayForItem resolves imageRendering through the usual precedence order', () => {
  // ref (manifest) sets it, nothing above overrides -> ref wins.
  const [fromRef] = DisplayForItem(
    null,
    { controls: { display: { imageRendering: 'pixelated' } } },
    {}
  );
  assert.equal((fromRef as { imageRendering?: string } | null)?.imageRendering, 'pixelated');

  // item-local display overrides the manifest's.
  const [itemWins] = DisplayForItem(
    null,
    { controls: { display: { imageRendering: 'pixelated' } } },
    { display: { imageRendering: 'auto' } }
  );
  assert.equal((itemWins as { imageRendering?: string } | null)?.imageRendering, 'auto');

  // defaults alone also carry it.
  const [fromDefaults] = DisplayForItem({ display: { imageRendering: 'auto' } }, null, {});
  assert.equal((fromDefaults as { imageRendering?: string } | null)?.imageRendering, 'auto');
});
