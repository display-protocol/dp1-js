import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseChannel } from '../../../src/extension/channels/index.js';

test('Channel_JSONRoundTrip', () => {
  const c = {
    id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
    slug: 's',
    title: 'C',
    version: '1.0.0',
    created: '2025-01-01T00:00:00Z',
    playlists: ['https://a'],
  };
  assert.deepEqual(parseChannel(c), c);
});
