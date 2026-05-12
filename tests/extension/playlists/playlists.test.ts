import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parsePlaylistsExtension, PlaylistsExtensionDocument } from '../../../src/index.js';

test('Overlay_JSONRoundTrip', () => {
  const o = {
    note: { text: 'Interlude', duration: 20 },
    curators: [{ name: 'A', key: 'did:key:z' }],
    summary: 'S',
    dynamicQuery: {
      profile: 'graphql-v1',
      endpoint: 'https://idx.example/gql',
      responseMapping: { itemsPath: 'data.items', itemSchema: 'dp1/1.1', itemMap: { id: '_id' } },
    },
  };
  assert.deepEqual(parsePlaylistsExtension(o), o);
  assert.deepEqual(JSON.parse(JSON.stringify(new PlaylistsExtensionDocument(o))), o);
});
