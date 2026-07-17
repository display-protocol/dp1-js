import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  DisplayPrefsBuilder,
  EntityBuilder,
  ProvenanceBuilder,
  ContractBuilder,
  DynamicQueryBuilder,
  ResponseMappingBuilder,
  ThumbnailBuilder,
} from '../../src/build/index.js';

test('DisplayPrefsBuilder rejects short hex colors on build()', () => {
  assert.throws(
    () => new DisplayPrefsBuilder().background('#111').build(),
    /#RRGGBB|transparent/i
  );
  assert.doesNotThrow(() => new DisplayPrefsBuilder().background('#111111').build());
});

test('EntityBuilder enforces DID key', () => {
  assert.throws(() => new EntityBuilder().name('A').key('nope').build(), /DID/i);
  assert.doesNotThrow(() =>
    new EntityBuilder().name('A').key('did:key:z6Mk').build()
  );
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

test('ThumbnailBuilder enforces uri and dimensions', () => {
  assert.throws(() => new ThumbnailBuilder().uri('x').widthPx(0).heightPx(10).build());
  assert.doesNotThrow(() =>
    new ThumbnailBuilder().uri('https://example.com/x.png').widthPx(10).heightPx(10).build()
  );
});

