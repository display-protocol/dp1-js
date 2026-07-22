import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import {
  computeActiveSet,
  nextDisplayAt,
  parseDisplayAt,
  type Playlist,
} from '../../src/index.js';
import { PlaylistWithPlaylistsExtension } from '../../src/validate/index.js';

const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

test('parseDisplayAt_with_timezone_Z', () => {
  const parsed = parseDisplayAt('2026-07-21T00:00:00Z');
  assert.equal(parsed.toISOString(), '2026-07-21T00:00:00.000Z');
});

test('parseDisplayAt_with_timezone_offset', () => {
  const parsed = parseDisplayAt('2026-07-21T09:00:00+07:00');
  assert.equal(parsed.toISOString(), '2026-07-21T02:00:00.000Z');
});

test('parseDisplayAt_with_compact_timezone_offset', () => {
  const parsed = parseDisplayAt('2026-07-21T09:00:00+0700');
  assert.equal(parsed.toISOString(), '2026-07-21T02:00:00.000Z');
});

test('parseDisplayAt_respects_DST_offsets', () => {
  const winter = parseDisplayAt('2026-01-15T12:00:00', 'America/New_York');
  const summer = parseDisplayAt('2026-07-15T12:00:00', 'America/New_York');
  assert.equal(winter.toISOString(), '2026-01-15T17:00:00.000Z');
  assert.equal(summer.toISOString(), '2026-07-15T16:00:00.000Z');
});

test('parseDisplayAt_without_timezone_uses_device_local', () => {
  process.env.TZ = 'UTC';
  const parsed = parseDisplayAt('2026-07-21T00:00:00');
  assert.equal(parsed.toISOString(), '2026-07-21T00:00:00.000Z');
});

test('parseDisplayAt_date_only_uses_local_midnight', () => {
  process.env.TZ = 'UTC';
  const parsed = parseDisplayAt('2026-07-21');
  assert.equal(parsed.toISOString(), '2026-07-21T00:00:00.000Z');
});

test('parseDisplayAt_with_explicit_localTimezone', () => {
  const parsed = parseDisplayAt('2026-07-21T09:00:00', 'Asia/Bangkok');
  assert.equal(parsed.toISOString(), '2026-07-21T02:00:00.000Z');
});

function dailyPlaylist(items: Playlist['items']): Playlist {
  return {
    dpVersion: '1.1.0',
    title: 'Daily',
    schedule: { byDisplayAt: true },
    items,
    signatures: [],
  };
}

test('computeActiveSet_mixed_items', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/intro', title: 'Intro' },
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-21T00:00:00Z' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-22T00:00:00Z' },
    { source: 'https://example.com/c', title: 'Work C', displayAt: '2026-07-22T00:00:00Z' },
    { source: 'https://example.com/outro', title: 'Outro' },
    { source: 'https://example.com/d', title: 'Work D', displayAt: '2026-07-23T00:00:00Z' },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-22T14:00:00Z'));
  assert.deepEqual(
    active.map(item => item.title),
    ['Intro', 'Work B', 'Work C', 'Outro']
  );
});

test('computeActiveSet_multiple_items_same_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-22T00:00:00Z' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-22T00:00:00Z' },
    { source: 'https://example.com/c', title: 'Work C', displayAt: '2026-07-21T00:00:00Z' },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.deepEqual(
    active.map(item => item.title),
    ['Work A', 'Work B']
  );
});

test('computeActiveSet_all_future_items_returns_evergreen_only', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/intro', title: 'Intro' },
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-23T00:00:00Z' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-24T00:00:00Z' },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.deepEqual(
    active.map(item => item.title),
    ['Intro']
  );
});

test('computeActiveSet_without_byDisplayAt_returns_all_items', () => {
  const playlist: Playlist = {
    dpVersion: '1.1.0',
    title: 'Plain',
    items: [
      { source: 'https://example.com/a', displayAt: '2026-07-23T00:00:00Z' },
      { source: 'https://example.com/b' },
    ],
    signatures: [],
  };

  const active = computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.equal(active.length, 2);
});

test('nextDisplayAt_returns_smallest_future_value', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', displayAt: '2026-07-21T00:00:00Z' },
    { source: 'https://example.com/b', displayAt: '2026-07-23T00:00:00Z' },
    { source: 'https://example.com/c', displayAt: '2026-07-24T00:00:00Z' },
    { source: 'https://example.com/d' },
  ]);

  const next = nextDisplayAt(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.equal(next?.toISOString(), '2026-07-23T00:00:00.000Z');
});

test('nextDisplayAt_returns_null_when_no_future_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', displayAt: '2026-07-21T00:00:00Z' },
    { source: 'https://example.com/b' },
  ]);

  assert.equal(nextDisplayAt(playlist, new Date('2026-07-22T10:00:00Z')), null);
});

test('parseDisplayAt_rejects_invalid_values', () => {
  assert.throws(() => parseDisplayAt(''), /dp1: displayAt must be a non-empty string/);
  assert.throws(() => parseDisplayAt('not-a-date'), /dp1: invalid displayAt/);
});

test('computeActiveSet_includes_items_at_exact_now', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-22T10:00:00Z' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-21T00:00:00Z' },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.deepEqual(
    active.map(item => item.title),
    ['Work A']
  );
});

test('computeActiveSet_forwards_localTimezone', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-22T00:00:00' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-23T00:00:00' },
  ]);

  const active = computeActiveSet(
    playlist,
    new Date('2026-07-21T20:00:00Z'),
    'Asia/Bangkok'
  );
  assert.deepEqual(
    active.map(item => item.title),
    ['Work A']
  );
});

test('nextDisplayAt_forwards_localTimezone', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', displayAt: '2026-07-22T00:00:00' },
    { source: 'https://example.com/b', displayAt: '2026-07-23T00:00:00' },
  ]);

  const next = nextDisplayAt(playlist, new Date('2026-07-21T20:00:00Z'), 'Asia/Bangkok');
  assert.equal(next?.toISOString(), '2026-07-22T17:00:00.000Z');
});

test('PlaylistWithPlaylistsExtension_accepts_local_displayAt_formats', () => {
  const payload = JSON.stringify({
    dpVersion: '1.1.0',
    title: 'Daily',
    schedule: { byDisplayAt: true },
    items: [
      { source: 'https://example.com/a', displayAt: '2026-07-21' },
      { source: 'https://example.com/b', displayAt: '2026-07-22T00:00:00' },
      { source: 'https://example.com/c', displayAt: '2026-07-23T00:00:00Z' },
    ],
    signatures: [
      {
        alg: 'ed25519',
        kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        ts: '2025-01-01T00:00:00Z',
        payload_hash:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        role: 'curator',
        sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    ],
  });

  assert.doesNotThrow(() => PlaylistWithPlaylistsExtension(Buffer.from(payload)));
});

test('computeActiveSet_all_future_without_evergreen_returns_empty', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-23T00:00:00Z' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-24T00:00:00Z' },
  ]);

  assert.deepEqual(computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z')), []);
});

test('computeActiveSet_all_past_keeps_newest_release_only', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-20T00:00:00Z' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-21T00:00:00Z' },
    { source: 'https://example.com/c', title: 'Work C', displayAt: '2026-07-21T00:00:00Z' },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.deepEqual(
    active.map(item => item.title),
    ['Work B', 'Work C']
  );
});

test('computeActiveSet_empty_items', () => {
  const playlist = dailyPlaylist([]);
  assert.deepEqual(computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z')), []);
});

test('computeActiveSet_mixed_absolute_and_local_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-22T00:00:00Z' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-22T07:00:00' },
    { source: 'https://example.com/c', title: 'Work C', displayAt: '2026-07-23T00:00:00Z' },
  ]);

  const active = computeActiveSet(
    playlist,
    new Date('2026-07-22T01:00:00Z'),
    'Asia/Bangkok'
  );
  assert.deepEqual(
    active.map(item => item.title),
    ['Work A', 'Work B']
  );
});

test('computeActiveSet_throws_on_malformed_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', displayAt: 'not-a-date' },
  ]);

  assert.throws(
    () => computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z')),
    /dp1: invalid displayAt/
  );
});

test('nextDisplayAt_throws_on_malformed_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', displayAt: 'not-a-date' },
  ]);

  assert.throws(
    () => nextDisplayAt(playlist, new Date('2026-07-22T10:00:00Z')),
    /dp1: invalid displayAt/
  );
});
