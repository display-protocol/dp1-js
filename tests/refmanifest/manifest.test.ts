import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseRefManifest, RefManifestDocument } from '../../src/index.js';

test('Manifest_JSONRoundTrip', () => {
  const m = {
    refVersion: '0.1.0',
    id: 'r',
    created: '2025-01-01T00:00:00Z',
    locale: 'en',
    metadata: { title: 'X', artists: [{ name: 'N' }] },
  };
  assert.deepEqual(parseRefManifest(m), m);
  assert.deepEqual(JSON.parse(JSON.stringify(new RefManifestDocument(m))), m);
});
