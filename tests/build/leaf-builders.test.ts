import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  ControlsBuilder,
  DisplayPrefsBuilder,
  EntityBuilder,
  ProvenanceBuilder,
  ContractBuilder,
  DynamicQueryBuilder,
  ResponseMappingBuilder,
  ReproBuilder,
  ThumbnailBuilder,
  NoteBuilder,
  validatePlaylistDraft,
  validateDynamicQueryDraft,
} from '../../src/build/index.js';

test('DisplayPrefsBuilder rejects short hex colors on build()', () => {
  assert.throws(() => new DisplayPrefsBuilder().background('#111').build(), /#RRGGBB|transparent/i);
  assert.doesNotThrow(() => new DisplayPrefsBuilder().background('#111111').build());
});

test('EntityBuilder enforces DID key', () => {
  assert.throws(() => new EntityBuilder().name('A').key('nope').build(), /DID/i);
  assert.doesNotThrow(() => new EntityBuilder().name('A').key('did:key:z6Mk').build());
});

test('ProvenanceBuilder requires contract for onChain', () => {
  assert.throws(() => new ProvenanceBuilder().type('onChain').build(), /contract is required/i);
  assert.doesNotThrow(() =>
    new ProvenanceBuilder()
      .type('onChain')
      .contract(new ContractBuilder().chain('evm').standard('erc721'))
      .build()
  );
});

test('ProvenanceBuilder validates plain-object dependencies on build()', () => {
  assert.throws(
    () =>
      new ProvenanceBuilder()
        .type('offChainURI')
        .dependencies([{ uri: 'not-a-uri' }])
        .build(),
    /uri/i
  );
});

test('DynamicQueryBuilder validates responseMapping.itemSchema pattern', () => {
  assert.throws(
    () =>
      new DynamicQueryBuilder()
        .profile('graphql-v1')
        .endpoint('https://idx.example/gql')
        .responseMapping(new ResponseMappingBuilder().itemsPath('data.items').itemSchema('nope'))
        .build(),
    /dp1\/1\.1/i
  );
  assert.doesNotThrow(() =>
    new DynamicQueryBuilder()
      .profile('graphql-v1')
      .endpoint('https://idx.example/gql')
      .responseMapping(new ResponseMappingBuilder().itemsPath('data.items').itemSchema('dp1/1.1'))
      .build()
  );
});

test('validateDynamicQueryDraft rejects unknown profile', () => {
  assert.throws(
    () =>
      validateDynamicQueryDraft({
        profile: 'nope' as 'graphql-v1',
        endpoint: 'https://idx.example/gql',
        responseMapping: { itemsPath: 'data.items', itemSchema: 'dp1/1.1' },
      }),
    /profile/i
  );
});

test('ThumbnailBuilder enforces uri and dimensions', () => {
  assert.throws(() => new ThumbnailBuilder().uri('x').widthPx(0).heightPx(10).build());
  assert.doesNotThrow(() =>
    new ThumbnailBuilder().uri('https://example.com/x.png').widthPx(10).heightPx(10).build()
  );
});

test('ReproBuilder rejects uppercase hex and validates plain frameHash', () => {
  assert.throws(() => new ReproBuilder().seedHex('0xABCDEF').build(), /lowercase/i);
  assert.throws(
    () =>
      new ReproBuilder()
        .frameHash({
          sha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        })
        .build(),
    /lowercase/i
  );
  assert.doesNotThrow(() =>
    new ReproBuilder()
      .seedHex('0xabcdef')
      .frameHash({
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })
      .build()
  );
});

test('ControlsBuilder validates plain-object display scaling', () => {
  assert.throws(
    () =>
      new ControlsBuilder().display({ scaling: 'nope' as 'fit', background: '#111111' }).build(),
    /scaling/i
  );
});

test('NoteBuilder enforces text length and duration', () => {
  assert.throws(() => new NoteBuilder().text('x'.repeat(501)).build(), /500/i);
  assert.throws(() => new NoteBuilder().text('ok').durationSeconds(0).build(), /> 0/i);
  assert.doesNotThrow(() => new NoteBuilder().text('ok').durationSeconds(20).build());
});

test('validatePlaylistDraft requires dynamicQuery when items empty', () => {
  assert.throws(
    () =>
      validatePlaylistDraft({
        dpVersion: '1.1.0',
        title: 'Empty',
        items: [],
      }),
    /dynamicQuery/i
  );
});
