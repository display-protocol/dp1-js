import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parsePlaylist, PlaylistDocument } from '../../src/index.js';

test('Playlist_JSONRoundTrip', () => {
  const p = {
    dpVersion: '1.1.0',
    id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
    title: 'T',
    note: { text: 'Show intro', duration: 5 },
    defaults: { display: { scaling: 'fit', autoplay: true }, license: 'open' },
    items: [
      {
        source: 'https://a',
        license: 'token',
        display: { scaling: 'fill' },
        note: { text: 'Item card' },
      },
    ],
    signatures: [],
  };
  assert.deepEqual(parsePlaylist(p), p);
  assert.deepEqual(JSON.parse(JSON.stringify(new PlaylistDocument(p))), p);
});
