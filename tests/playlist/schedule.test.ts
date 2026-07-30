import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import {
  computeActiveSet,
  nextDisplayAt,
  parseDisplayAt,
  parseDisplayAtNanoseconds,
  type Playlist,
} from '../../src/index.js';
import { PlaylistWithPlaylistsExtension } from '../../src/validate/index.js';

const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

function dailyPlaylist(items: Playlist['items']): Playlist {
  return {
    dpVersion: '1.1.0',
    title: 'Daily',
    items,
    signatures: [],
  };
}

test('parseDisplayAt_with_timezone_Z', () => {
  const parsed = parseDisplayAt('2026-07-21T00:00:00Z');
  assert.equal(parsed.toISOString(), '2026-07-21T00:00:00.000Z');
});

test('parseDisplayAt_with_timezone_offset', () => {
  const parsed = parseDisplayAt('2026-07-21T09:00:00+07:00');
  assert.equal(parsed.toISOString(), '2026-07-21T02:00:00.000Z');
});

test('parseDisplayAt_rejects_compact_timezone_offset', () => {
  assert.throws(() => parseDisplayAt('2026-07-21T09:00:00+0700'), /dp1: invalid displayAt/);
});

test('parseDisplayAt_rejects_date_only', () => {
  assert.throws(() => parseDisplayAt('2026-07-21'), /dp1: invalid displayAt/);
});

test('parseDisplayAt_respects_DST_offsets', () => {
  const winter = parseDisplayAt('2026-01-15T12:00:00', 'America/New_York');
  const summer = parseDisplayAt('2026-07-15T12:00:00', 'America/New_York');
  assert.equal(winter.toISOString(), '2026-01-15T17:00:00.000Z');
  assert.equal(summer.toISOString(), '2026-07-15T16:00:00.000Z');
});

test('parseDisplayAt_preserves_fractional_seconds_in_local_time', () => {
  const ny = parseDisplayAt('2026-07-15T12:00:00.500', 'America/New_York');
  const utc = parseDisplayAt('2026-07-22T00:00:00.500', 'UTC');
  assert.equal(ny.toISOString(), '2026-07-15T16:00:00.500Z');
  assert.equal(utc.toISOString(), '2026-07-22T00:00:00.500Z');
});

test('parseDisplayAtNanoseconds_preserves_submillisecond_precision', () => {
  const base = BigInt(new Date('2026-07-22T00:00:00Z').getTime()) * 1_000_000n;
  assert.equal(parseDisplayAtNanoseconds('2026-07-22T00:00:00.0001Z'), base + 100_000n);
  assert.equal(parseDisplayAtNanoseconds('2026-07-22T00:00:00.0009Z'), base + 900_000n);
  assert.equal(parseDisplayAtNanoseconds('2026-07-22T00:00:00.0001', 'UTC'), base + 100_000n);
});

test('parseDisplayAt_floors_pre_epoch_submillisecond_values', () => {
  assert.equal(
    parseDisplayAt('1969-12-31T23:59:59.9999Z').toISOString(),
    '1969-12-31T23:59:59.999Z'
  );
});

test('parseDisplayAt_DST_gap_resolves_to_first_instant_after_gap', () => {
  // 2026-03-08 America/New_York springs forward 02:00 → 03:00.
  const resolved = parseDisplayAt('2026-03-08T02:30:00', 'America/New_York');
  assert.equal(resolved.toISOString(), '2026-03-08T07:00:00.000Z'); // 03:00 EDT
});

test('parseDisplayAt_DST_gap_discards_fractional_seconds_at_transition', () => {
  const resolved = parseDisplayAt('2026-03-08T02:30:00.500', 'America/New_York');
  assert.equal(resolved.toISOString(), '2026-03-08T07:00:00.000Z');
});

test('parseDisplayAt_DST_fold_resolves_to_earlier_instant', () => {
  // 2025-11-02 America/New_York falls back; 01:30 occurs twice.
  const resolved = parseDisplayAt('2025-11-02T01:30:00', 'America/New_York');
  assert.equal(resolved.toISOString(), '2025-11-02T05:30:00.000Z'); // EDT (earlier)
});

test('parseDisplayAt_without_timezone_uses_device_local', () => {
  process.env.TZ = 'UTC';
  const parsed = parseDisplayAt('2026-07-21T00:00:00');
  assert.equal(parsed.toISOString(), '2026-07-21T00:00:00.000Z');
});

test('parseDisplayAt_with_explicit_localTimezone', () => {
  const parsed = parseDisplayAt('2026-07-21T09:00:00', 'Asia/Bangkok');
  assert.equal(parsed.toISOString(), '2026-07-21T02:00:00.000Z');
});

test('parseDisplayAt_rejects_invalid_calendar_day', () => {
  assert.throws(() => parseDisplayAt('2026-02-30T00:00:00'), /dp1: invalid displayAt/);
  assert.throws(() => parseDisplayAt('2026-02-30T00:00:00Z'), /dp1: invalid displayAt/);
});

test('parseDisplayAt_rejects_invalid_values', () => {
  assert.throws(() => parseDisplayAt(''), /dp1: displayAt must be a non-empty string/);
  assert.throws(() => parseDisplayAt('not-a-date'), /dp1: invalid displayAt/);
  assert.throws(() => parseDisplayAt('2026-07-21T00:00'), /dp1: invalid displayAt/);
  assert.throws(() => parseDisplayAt(' 2026-07-21T00:00:00Z'), /dp1: invalid displayAt/);
});

test('parseDisplayAt_preserves_years_before_0100', () => {
  assert.equal(parseDisplayAt('0001-01-01T00:00:00Z').toISOString(), '0001-01-01T00:00:00.000Z');
  assert.equal(
    parseDisplayAt('0099-12-31T23:59:59', 'UTC').toISOString(),
    '0099-12-31T23:59:59.000Z'
  );
});

test('parseDisplayAt_preserves_fractional_local_years_before_0100', () => {
  assert.equal(
    parseDisplayAt('0099-12-31T23:59:59.500', 'UTC').toISOString(),
    '0099-12-31T23:59:59.500Z'
  );
  assert.equal(
    parseDisplayAt('0000-01-01T00:00:00.500', 'UTC').toISOString(),
    '0000-01-01T00:00:00.500Z'
  );
});

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

test('computeActiveSet_same_instant_different_wire_strings', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-21T00:00:00Z' },
    {
      source: 'https://example.com/b',
      title: 'Work B',
      displayAt: '2026-07-21T07:00:00+07:00',
    },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-21T12:00:00Z'));
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

test('computeActiveSet_activates_when_any_item_has_displayAt', () => {
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
  assert.deepEqual(
    active.map(item => item.source),
    ['https://example.com/b']
  );
});

test('computeActiveSet_returns_all_items_without_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A' },
    { source: 'https://example.com/b', title: 'Work B' },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.deepEqual(active, playlist.items);
  assert.notEqual(active, playlist.items);
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

test('computeActiveSet_includes_fractional_local_displayAt_at_exact_now', () => {
  const playlist = dailyPlaylist([
    {
      source: 'https://example.com/a',
      title: 'Work A',
      displayAt: '2026-07-22T00:00:00.500',
    },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-22T00:00:00.500Z'), 'UTC');
  assert.deepEqual(
    active.map(item => item.title),
    ['Work A']
  );
  assert.equal(nextDisplayAt(playlist, new Date('2026-07-22T00:00:00.500Z'), 'UTC'), null);
});

test('schedule_helpers_distinguish_submillisecond_displayAt_values', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/first', displayAt: '2026-07-22T00:00:00.0001Z' },
    { source: 'https://example.com/second', displayAt: '2026-07-22T00:00:00.0009Z' },
  ]);
  const base = BigInt(new Date('2026-07-22T00:00:00Z').getTime()) * 1_000_000n;

  assert.deepEqual(computeActiveSet(playlist, base), []);
  assert.equal(nextDisplayAt(playlist, base), base + 100_000n);
  assert.deepEqual(
    computeActiveSet(playlist, base + 100_000n).map(item => item.source),
    ['https://example.com/first']
  );
  assert.equal(nextDisplayAt(playlist, base + 100_000n), base + 900_000n);
  assert.deepEqual(
    computeActiveSet(playlist, base + 900_000n).map(item => item.source),
    ['https://example.com/second']
  );
});

test('nextDisplayAt_Date_rounds_submillisecond_values_up_to_avoid_early_timers', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/first', displayAt: '2026-07-22T00:00:00.0001Z' },
  ]);

  assert.equal(
    nextDisplayAt(playlist, new Date('2026-07-22T00:00:00Z'))?.toISOString(),
    '2026-07-22T00:00:00.001Z'
  );
});

test('computeActiveSet_forwards_localTimezone', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-22T00:00:00' },
    { source: 'https://example.com/b', title: 'Work B', displayAt: '2026-07-23T00:00:00' },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-21T20:00:00Z'), 'Asia/Bangkok');
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

test('PlaylistWithPlaylistsExtension_accepts_spec_displayAt_formats', () => {
  const payload = JSON.stringify({
    dpVersion: '1.1.0',
    title: 'Daily',
    items: [
      { source: 'https://example.com/a', displayAt: '2026-07-21T00:00:00' },
      { source: 'https://example.com/b', displayAt: '2026-07-22T00:00:00Z' },
      { source: 'https://example.com/c', displayAt: '2026-07-23T09:00:00+07:00' },
    ],
    signatures: [
      {
        alg: 'ed25519',
        kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        ts: '2025-01-01T00:00:00Z',
        payload_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        role: 'curator',
        sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    ],
  });

  assert.doesNotThrow(() => PlaylistWithPlaylistsExtension(Buffer.from(payload)));
});

test('PlaylistWithPlaylistsExtension_rejects_date_only_and_compact_offset', () => {
  const dateOnly = JSON.stringify({
    dpVersion: '1.1.0',
    title: 'Daily',
    items: [{ source: 'https://example.com/a', displayAt: '2026-07-21' }],
    signatures: [
      {
        alg: 'ed25519',
        kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        ts: '2025-01-01T00:00:00Z',
        payload_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        role: 'curator',
        sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    ],
  });
  const compact = JSON.stringify({
    dpVersion: '1.1.0',
    title: 'Daily',
    items: [{ source: 'https://example.com/a', displayAt: '2026-07-21T00:00:00+0700' }],
    signatures: [
      {
        alg: 'ed25519',
        kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        ts: '2025-01-01T00:00:00Z',
        payload_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        role: 'curator',
        sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    ],
  });

  assert.throws(() => PlaylistWithPlaylistsExtension(Buffer.from(dateOnly)));
  assert.throws(() => PlaylistWithPlaylistsExtension(Buffer.from(compact)));
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

  const active = computeActiveSet(playlist, new Date('2026-07-22T01:00:00Z'), 'Asia/Bangkok');
  assert.deepEqual(
    active.map(item => item.title),
    ['Work A', 'Work B']
  );
});

test('computeActiveSet_skips_malformed_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/bad', title: 'Bad', displayAt: 'not-a-date' },
    { source: 'https://example.com/a', title: 'Work A', displayAt: '2026-07-22T00:00:00Z' },
    { source: 'https://example.com/intro', title: 'Intro' },
  ]);

  const active = computeActiveSet(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.deepEqual(
    active.map(item => item.title),
    ['Work A', 'Intro']
  );
});

test('nextDisplayAt_skips_malformed_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/bad', displayAt: 'not-a-date' },
    { source: 'https://example.com/a', displayAt: '2026-07-23T00:00:00Z' },
  ]);

  const next = nextDisplayAt(playlist, new Date('2026-07-22T10:00:00Z'));
  assert.equal(next?.toISOString(), '2026-07-23T00:00:00.000Z');
});

test('schedule_helpers_skip_owned_non_string_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/bad', displayAt: null } as unknown as Playlist['items'][number],
    { source: 'https://example.com/current', displayAt: '2026-07-22T00:00:00Z' },
    { source: 'https://example.com/future', displayAt: '2026-07-23T00:00:00Z' },
  ]);
  const now = new Date('2026-07-22T10:00:00Z');

  assert.deepEqual(
    computeActiveSet(playlist, now).map(item => item.source),
    ['https://example.com/current']
  );
  assert.equal(nextDisplayAt(playlist, now)?.toISOString(), '2026-07-23T00:00:00.000Z');
});

test('schedule_helpers_skip_whitespace_padded_displayAt', () => {
  const playlist = dailyPlaylist([
    { source: 'https://example.com/padded', displayAt: ' 2026-07-22T00:00:00Z' },
    { source: 'https://example.com/current', displayAt: '2026-07-22T00:00:00Z' },
    { source: 'https://example.com/future', displayAt: '2026-07-23T00:00:00Z' },
  ]);
  const now = new Date('2026-07-22T10:00:00Z');

  assert.deepEqual(
    computeActiveSet(playlist, now).map(item => item.source),
    ['https://example.com/current']
  );
  assert.equal(nextDisplayAt(playlist, now)?.toISOString(), '2026-07-23T00:00:00.000Z');
});
