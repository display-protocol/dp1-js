import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parsePlaylistGroup, PlaylistGroupDocument } from '../../src/index.js';

test('Group_JSONRoundTrip', () => {
  const g = {
    id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
    title: 'Ex',
    playlists: ['https://p.json'],
    created: '2025-01-01T00:00:00Z',
    signatures: [],
  };
  assert.deepEqual(parsePlaylistGroup(g), g);
  assert.deepEqual(JSON.parse(JSON.stringify(new PlaylistGroupDocument(g))), g);
});
