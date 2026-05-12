import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseEntity, EntityDocument } from '../../../src/index.js';

test('Entity_JSONRoundTrip', () => {
  const e = { name: 'N', key: 'did:key:z', url: 'https://x' };
  assert.deepEqual(parseEntity(e), e);
  assert.deepEqual(JSON.parse(JSON.stringify(new EntityDocument(e))), e);
});
