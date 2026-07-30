import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  ChannelBuilder,
  DisplayControlsBuilder,
  DynamicQueryBuilder,
  EntityBuilder,
  NoteBuilder,
  PlaylistBuilder,
  PlaylistGroupBuilder,
  PlaylistItemBuilder,
  RefManifestBuilder,
  ResponseMappingBuilder,
} from '../../src/build/index.js';
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
