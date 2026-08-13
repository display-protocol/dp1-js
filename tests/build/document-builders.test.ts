import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  ArtistBuilder,
  ChannelBuilder,
  ControlsBuilder,
  DisplayControlsBuilder,
  DisplayPrefsBuilder,
  DynamicQueryBuilder,
  EntityBuilder,
  LocalizedMetadataBuilder,
  MetadataBuilder,
  NoteBuilder,
  PlaylistBuilder,
  PlaylistGroupBuilder,
  PlaylistItemBuilder,
  ProvenanceBuilder,
  RefManifestBuilder,
  ReproBuilder,
  ResponseMappingBuilder,
  ThumbnailBuilder,
} from '../../src/build/index.js';
import type { Channel } from '../../src/index.js';
import { ErrValidation } from '../../src/errors.js';

function isValidationError(err: unknown): boolean {
  return err instanceof Error && err.cause === ErrValidation;
}

test('PlaylistItemBuilder requires source and validates via AJV', () => {
  assert.throws(() => new PlaylistItemBuilder().build(), isValidationError);
  const item = new PlaylistItemBuilder().source('https://example.com/a.html').build();
  assert.equal(item.source, 'https://example.com/a.html');
});

test('PlaylistItemBuilder accepts extension note and displayAt', () => {
  const item = new PlaylistItemBuilder()
    .source('https://example.com/a.html')
    .note(new NoteBuilder().text('break'))
    .displayAt('2026-07-21T00:00:00Z')
    .build();
  assert.equal(item.note?.text, 'break');
  assert.equal(item.displayAt, '2026-07-21T00:00:00Z');
});

test('PlaylistItemBuilder carries an inline ref manifest', () => {
  const manifest = new RefManifestBuilder()
    .locale('en')
    .metadata(
      new MetadataBuilder()
        .title('Pre-Process')
        .addArtist(new ArtistBuilder().name('Casey Reas').url('https://reas.com'))
        .addThumbnail('default', new ThumbnailBuilder().uri('https://cdn.example.com/l.jpg'))
    );
  const item = new PlaylistItemBuilder()
    .source('https://example.com/a.html')
    .inlineManifest(manifest)
    .build();
  assert.equal(item.inlineManifest?.metadata?.title, 'Pre-Process');
  assert.equal(item.inlineManifest?.metadata?.artists?.[0]?.name, 'Casey Reas');
  // A bare thumbnail URL carries no dimensions.
  assert.equal(item.inlineManifest?.metadata?.thumbnails?.default?.w, undefined);
  assert.match(item.inlineManifest?.id ?? '', /^[0-9a-f-]{36}$/i);
});

test('PlaylistItemBuilder rejects a malformed raw inline manifest', () => {
  for (const manifest of [
    // `locale` is required by the ref-manifest schema.
    { refVersion: '0.1.0', id: 'r', created: '2025-01-01T00:00:00Z' },
    { refVersion: 'nope', id: 'r', created: '2025-01-01T00:00:00Z', locale: 'en' },
    {
      refVersion: '0.1.0',
      id: 'r',
      created: '2025-01-01T00:00:00Z',
      locale: 'en',
      metadata: { thumbnails: { default: { uri: 'https://example.com/t.jpg', w: 0 } } },
    },
  ]) {
    assert.throws(
      () =>
        new PlaylistItemBuilder()
          .source('https://example.com/a.html')
          .inlineManifest(manifest as never)
          .build(),
      isValidationError,
      JSON.stringify(manifest)
    );
  }
});

test('PlaylistItemBuilder rejects invalid displayAt', () => {
  assert.throws(
    () =>
      new PlaylistItemBuilder()
        .source('https://example.com/a.html')
        .displayAt('2026-07-21')
        .build(),
    isValidationError
  );
});

test('PlaylistBuilder builds unsigned core playlist', () => {
  const builder = new PlaylistBuilder()
    .title('Show')
    .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'));
  const playlist = builder.build();
  assert.equal(playlist.title, 'Show');
  assert.equal(playlist.dpVersion, '1.1.0');
  assert.equal(playlist.items.length, 1);
  assert.equal(playlist.signatures, undefined);
  assert.equal(playlist.signature, undefined);
  assert.match(playlist.id ?? '', /^[0-9a-f-]{36}$/i);
  assert.equal(builder.build().id, playlist.id);
  assert.equal(builder.build().created, playlist.created);
});

test('PlaylistBuilder rejects missing title', () => {
  assert.throws(
    () =>
      new PlaylistBuilder()
        .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
        .build(),
    isValidationError
  );
});

test('PlaylistBuilder uses extension schema for item note and summary', () => {
  const withItemNote = new PlaylistBuilder()
    .title('Show')
    .addItem(
      new PlaylistItemBuilder()
        .source('https://example.com/a.html')
        .note(new NoteBuilder().text('break'))
    )
    .build();
  assert.equal(withItemNote.items[0]?.note?.text, 'break');

  // inlineManifest is an extension field too, so it routes to the composed schema and a
  // malformed nested manifest is caught at the playlist level.
  const withInline = new PlaylistBuilder()
    .title('Show')
    .addItem(
      new PlaylistItemBuilder()
        .source('https://example.com/a.html')
        .inlineManifest(new RefManifestBuilder().locale('en'))
    )
    .build();
  assert.equal(withInline.items[0]?.inlineManifest?.locale, 'en');

  assert.throws(
    () =>
      new PlaylistBuilder()
        .title('Show')
        .items([
          {
            source: 'https://example.com/a.html',
            inlineManifest: {
              refVersion: '0.1.0',
              id: 'r',
              created: 'nope',
              locale: 'en',
            } as never,
          },
        ])
        .build(),
    isValidationError
  );

  const withSummary = new PlaylistBuilder()
    .title('Show')
    .summary('Curated works')
    .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
    .build();
  assert.equal(withSummary.summary, 'Curated works');

  assert.throws(() => new PlaylistBuilder().title('Empty').items([]).build(), isValidationError);

  const dynamic = new PlaylistBuilder()
    .title('Feed')
    .items([])
    .dynamicQuery(
      new DynamicQueryBuilder()
        .profile('https-json-v1')
        .endpoint('https://idx.example/items')
        .responseMapping(new ResponseMappingBuilder().itemsPath('items').itemSchema('dp1/1.1'))
    )
    .build();
  assert.equal(dynamic.items.length, 0);
  assert.equal(dynamic.dynamicQuery?.profile, 'https-json-v1');
});

test('PlaylistGroupBuilder builds unsigned group', () => {
  const group = new PlaylistGroupBuilder()
    .title('Exhibition')
    .addPlaylist('https://example.com/p.json')
    .build();
  assert.equal(group.title, 'Exhibition');
  assert.equal(group.playlists.length, 1);
  assert.equal(group.signatures, undefined);
  assert.throws(
    () => new PlaylistGroupBuilder().title('x').playlists([]).build(),
    isValidationError
  );
  assert.throws(
    () => new PlaylistGroupBuilder().addPlaylist('https://example.com/p.json').build(),
    isValidationError
  );
});

test('ChannelBuilder builds unsigned channel', () => {
  const channel = new ChannelBuilder()
    .slug('main-feed')
    .title('Main')
    .addPlaylist('https://example.com/p.json')
    .addCurator(new EntityBuilder().name('Cur').key('did:key:z6Mk'))
    .build();
  assert.equal(channel.slug, 'main-feed');
  assert.equal(channel.version, '1.0.0');
  assert.equal(channel.signatures, undefined);
  assert.throws(
    () => new ChannelBuilder().slug('Bad Slug').title('Main').addPlaylist('https://p').build(),
    isValidationError
  );
  assert.throws(
    () => new ChannelBuilder().title('Main').addPlaylist('https://example.com/p.json').build(),
    isValidationError
  );
  assert.throws(
    () => new ChannelBuilder().slug('main-feed').title('Main').playlists([]).build(),
    isValidationError
  );
});

test('Channel type accepts publisher signature role', () => {
  const channel = {
    id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
    slug: 's',
    title: 'c',
    version: '1.0.0',
    created: '2025-01-01T00:00:00Z',
    playlists: ['https://p'],
    signatures: [
      {
        alg: 'ed25519',
        kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        ts: '2025-01-01T00:00:00Z',
        payload_hash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        role: 'publisher',
        sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    ],
  } satisfies Channel;

  assert.equal(channel.signatures[0].role, 'publisher');
});

test('RefManifestBuilder builds validated manifest', () => {
  const manifest = new RefManifestBuilder()
    .metadata({ title: 'Work' })
    .controls({ display: new DisplayControlsBuilder().scaling('fit').build() })
    .build();
  assert.equal(manifest.refVersion, '0.1.0');
  assert.equal(manifest.locale, 'en');
  assert.equal(manifest.metadata?.title, 'Work');
  assert.throws(() => new RefManifestBuilder().locale('EN').build(), isValidationError);
});

test('PlaylistItemBuilder covers optional core fields', () => {
  const item = new PlaylistItemBuilder()
    .id('11111111-1111-4111-8111-111111111111')
    .slug('work-a')
    .title('Work A')
    .source('https://example.com/a.html')
    .durationSeconds(30)
    .license('open')
    .ref('https://example.com/ref.json')
    .override({ foo: 1 })
    .display(new DisplayPrefsBuilder().scaling('fit'))
    .repro(new ReproBuilder().seedHex('0xabcdef'))
    .provenance(new ProvenanceBuilder().type('offChainURI'))
    .build();
  assert.equal(item.slug, 'work-a');
  assert.equal(item.license, 'open');
  assert.equal(item.display?.scaling, 'fit');
  assert.equal(item.repro?.seed, '0xabcdef');
  assert.equal(item.provenance?.type, 'offChainURI');
  assert.throws(
    () =>
      new PlaylistItemBuilder()
        .source('https://example.com/a.html')
        .license('nope' as 'open')
        .build(),
    isValidationError
  );
});

test('PlaylistBuilder covers defaults curators and coverImage', () => {
  const playlist = new PlaylistBuilder()
    .dpVersion('1.1.0')
    .id('22222222-2222-4222-8222-222222222222')
    .slug('show')
    .title('Show')
    .created('2026-01-01T00:00:00Z')
    .defaults({ license: 'token' })
    .defaultDisplay(new DisplayPrefsBuilder().loop(true))
    .defaultLicense('open')
    .defaultDurationSeconds(60)
    .note(new NoteBuilder().text('intro'))
    .addCurator(new EntityBuilder().name('C').key('did:key:z6Mk'))
    .curators([new EntityBuilder().name('D').key('did:key:z6Mk')])
    .coverImage('https://example.com/cover.png')
    .addItem(
      new PlaylistItemBuilder()
        .source('https://example.com/a.html')
        .displayAt('2026-07-21T00:00:00Z')
    )
    .build();
  assert.equal(playlist.defaults?.license, 'open');
  assert.equal(playlist.defaults?.duration, 60);
  assert.equal(playlist.defaults?.display?.loop, true);
  assert.equal(playlist.coverImage, 'https://example.com/cover.png');
  assert.equal(playlist.curators?.[0]?.name, 'D');
  assert.equal(playlist.items[0]?.displayAt, '2026-07-21T00:00:00Z');
});

test('ChannelBuilder covers optional metadata setters', () => {
  const channel = new ChannelBuilder()
    .id('33333333-3333-4333-8333-333333333333')
    .slug('main-feed')
    .title('Main')
    .version('1.0.0')
    .created('2026-01-01T00:00:00Z')
    .playlists(['https://example.com/p.json'])
    .curators([new EntityBuilder().name('C').key('did:key:z6Mk')])
    .publisher(new EntityBuilder().name('P').key('did:key:z6Mk'))
    .summary('S')
    .coverImage('https://example.com/c.png')
    .build();
  assert.equal(channel.publisher?.name, 'P');
  assert.equal(channel.summary, 'S');
  assert.equal(channel.coverImage, 'https://example.com/c.png');
  assert.equal(channel.curators?.[0]?.name, 'C');
});

test('PlaylistGroupBuilder covers optional metadata setters', () => {
  const group = new PlaylistGroupBuilder()
    .id('44444444-4444-4444-8444-444444444444')
    .slug('ex')
    .title('Exhibition')
    .curator('Cur')
    .summary('S')
    .created('2026-01-01T00:00:00Z')
    .coverImage('https://example.com/c.png')
    .playlists(['https://example.com/p.json'])
    .build();
  assert.equal(group.slug, 'ex');
  assert.equal(group.curator, 'Cur');
  assert.equal(group.summary, 'S');
  assert.equal(group.coverImage, 'https://example.com/c.png');
});

test('RefManifestBuilder covers explicit fields and i18n', () => {
  const manifest = new RefManifestBuilder()
    .refVersion('0.1.0')
    .id('55555555-5555-4555-8555-555555555555')
    .created('2026-01-01T00:00:00Z')
    .locale('en')
    .metadata(new MetadataBuilder().title('Work'))
    .controls(new ControlsBuilder().display(new DisplayControlsBuilder().scaling('fit')))
    .i18n({ fr: { title: 'Oeuvre' } })
    .build();
  assert.equal(manifest.refVersion, '0.1.0');
  assert.equal(manifest.id, '55555555-5555-4555-8555-555555555555');
  assert.equal(manifest.i18n?.fr?.title, 'Oeuvre');
  assert.equal(manifest.metadata?.title, 'Work');
});

test('RefManifestBuilder accepts LocalizedMetadataBuilder values for i18n', () => {
  const manifest = new RefManifestBuilder()
    .locale('en')
    .i18n({
      fr: new LocalizedMetadataBuilder().title('Œuvre').creditLine('Crédit'),
    })
    .addLocalized('vi', new LocalizedMetadataBuilder().title('Tác phẩm').description('Mô tả'))
    .build();
  assert.equal(manifest.i18n?.fr?.title, 'Œuvre');
  assert.equal(manifest.i18n?.fr?.creditLine, 'Crédit');
  assert.equal(manifest.i18n?.vi?.description, 'Mô tả');
});

test('LocalizedMetadataBuilder rejects a non-string field', () => {
  assert.throws(() => new LocalizedMetadataBuilder().title(42 as never).build(), isValidationError);
});
