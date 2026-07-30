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
} from '../../src/build/index.js';
import { ErrValidation } from '../../src/errors.js';
import {
  DynamicQuery as ValidateDynamicQuery,
  Playlist as ValidatePlaylist,
} from '../../src/validate/index.js';

function isValidationError(err: unknown): boolean {
  return err instanceof Error && err.cause === ErrValidation;
}

test('DisplayPrefsBuilder rejects short hex colors on build()', () => {
  assert.throws(() => new DisplayPrefsBuilder().background('#111').build(), isValidationError);
  assert.doesNotThrow(() => new DisplayPrefsBuilder().background('#111111').build());
});

test('EntityBuilder enforces DID key', () => {
  assert.throws(() => new EntityBuilder().name('A').key('nope').build(), isValidationError);
  assert.doesNotThrow(() => new EntityBuilder().name('A').key('did:key:z6Mk').build());
});

test('ProvenanceBuilder requires contract for onChain', () => {
  assert.throws(() => new ProvenanceBuilder().type('onChain').build(), isValidationError);
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
    isValidationError
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
    isValidationError
  );
  assert.doesNotThrow(() =>
    new DynamicQueryBuilder()
      .profile('graphql-v1')
      .endpoint('https://idx.example/gql')
      .responseMapping(new ResponseMappingBuilder().itemsPath('data.items').itemSchema('dp1/1.1'))
      .build()
  );
});

test('ValidateDynamicQuery rejects unknown profile', () => {
  assert.throws(
    () =>
      ValidateDynamicQuery({
        profile: 'nope',
        endpoint: 'https://idx.example/gql',
        responseMapping: { itemsPath: 'data.items', itemSchema: 'dp1/1.1' },
      }),
    isValidationError
  );
});

test('ThumbnailBuilder enforces uri and dimensions', () => {
  assert.throws(
    () => new ThumbnailBuilder().uri('x').widthPx(0).heightPx(10).build(),
    isValidationError
  );
  assert.doesNotThrow(() =>
    new ThumbnailBuilder().uri('https://example.com/x.png').widthPx(10).heightPx(10).build()
  );
});

test('ReproBuilder rejects uppercase hex and validates plain frameHash', () => {
  assert.throws(() => new ReproBuilder().seedHex('0xABCDEF').build(), isValidationError);
  assert.throws(
    () =>
      new ReproBuilder()
        .frameHash({
          sha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        })
        .build(),
    isValidationError
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
    isValidationError
  );
});

test('NoteBuilder enforces text length and duration', () => {
  assert.throws(() => new NoteBuilder().text('x'.repeat(501)).build(), isValidationError);
  assert.throws(() => new NoteBuilder().text('ok').durationSeconds(0).build(), isValidationError);
  assert.doesNotThrow(() => new NoteBuilder().text('ok').durationSeconds(20).build());
});

test('ValidatePlaylist rejects empty items without signatures option path', () => {
  assert.throws(
    () =>
      ValidatePlaylist(
        Buffer.from(JSON.stringify({ dpVersion: '1.1.0', title: 'Empty', items: [] })),
        {
          requireSignatures: false,
        }
      ),
    isValidationError
  );
});
