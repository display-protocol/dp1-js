import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  parseDP1Playlist,
  parseChannel,
  parseRefManifest,
  ParseAndValidatePlaylist,
  ParseAndValidatePlaylistWithPlaylistsExtension,
  ParseAndValidatePlaylistGroup,
  ParseAndValidateRefManifest,
  ParseAndValidateChannel,
  ParseDPVersion,
  parsePlaylist,
  PlaylistBuilder,
  WarnMajorMismatch,
} from '../src/index.js';
import { ErrValidation, withCode, codeFromValidation, ErrorCode } from '../src/errors.js';

function isPlaylistInvalid(err: unknown) {
  return err instanceof Error && (err as { code?: string }).code === ErrorCode.PlaylistInvalid;
}

function isCode(code: string) {
  return (err: unknown) => err instanceof Error && (err as { code?: string }).code === code;
}

test('ParseAndValidatePlaylist_legacySigned', () => {
  const res = parseDP1Playlist(
    {
      dpVersion: '1.0.0',
      title: 'x',
      items: [{ source: 'https://example.com' }],
    },
    { requireSignatures: false }
  );
  assert.equal(res.error, null);
});

test('parseDP1Playlist_returnsDetailsOnFailure', () => {
  const res = parseDP1Playlist(
    {
      dpVersion: '1.0.0',
      title: 'x',
      items: [{}],
    },
    { requireSignatures: false }
  );
  assert.equal(res.playlist, null);
  assert.equal(res.error?.message, 'dp1: validation failed');
  assert.ok((res.error?.details.length ?? 0) > 0);
});

// R3: the shallow hand-written parse* helpers used to accept documents the published schema rejects.
test('parse helpers validate against the published schema', () => {
  const unsigned = { dpVersion: '1.1.0', title: 'x', items: [{ source: 'https://a' }] };
  // missing signature(s): rejected by default, accepted only when explicitly opted out
  assert.ok(parseDP1Playlist(unsigned).error);
  assert.equal(parseDP1Playlist(unsigned, { requireSignatures: false }).error, null);
  // bad dpVersion pattern passes the old string check but not the schema
  assert.ok(
    parseDP1Playlist({ ...unsigned, dpVersion: 'one' }, { requireSignatures: false }).error
  );
  assert.throws(() => parseChannel({ title: 't' }));
  assert.throws(() => parseRefManifest({ refVersion: 'x', id: 'r', created: 'c', locale: 'en' }));
});

test('ParseAndValidatePlaylist_schemaRejectsInvalidDoc', () => {
  assert.throws(
    () => ParseAndValidatePlaylist(Buffer.from('{"dpVersion":"1.1.0","title":"","items":[]}')),
    isPlaylistInvalid
  );
});

test('ParseAndValidatePlaylistWithPlaylistsExtension', () => {
  assert.throws(
    () => ParseAndValidatePlaylistWithPlaylistsExtension(Buffer.from('{}')),
    isCode(ErrorCode.PlaylistInvalid)
  );
});

test('ParseAndValidatePlaylistGroup', () => {
  assert.throws(
    () => ParseAndValidatePlaylistGroup(Buffer.from('{}')),
    isCode(ErrorCode.PlaylistGroupInvalid)
  );
});

test('ParseAndValidateRefManifest', () => {
  assert.throws(
    () => ParseAndValidateRefManifest(Buffer.from('{}')),
    isCode(ErrorCode.RefManifestInvalid)
  );
});

test('ParseAndValidateRefManifest_artistProfile', () => {
  const withArtist = (a: unknown) =>
    Buffer.from(
      JSON.stringify({
        refVersion: '1.1.0',
        id: 'r',
        created: '2025-01-01T00:00:00Z',
        locale: 'en',
        metadata: { artists: [a] },
      })
    );
  // The full 1.1.0 profile as a producer should emit it: no deprecated url,
  // full URLs in links, w/h present on the avatar.
  const full = withArtist({
    name: 'Casey Reas',
    id: '58',
    addresses: [
      '0x457ee5f723c7606c12a7264b52e285906f91eea6',
      'tz1LBwyJMRkH4tcG19KwYzAW7fLYbjFmWdWy',
    ],
    avatar: { uri: 'https://a.example/reas.jpg', w: 512, h: 512 },
    biographies: [
      { text: 'Software artist.', source: 'DAM', sourceUrl: 'https://dam.org/reas' },
      { text: 'Co-founder of Processing.' },
    ],
    links: [
      { type: 'website', url: 'https://reas.com' },
      { type: 'other', url: 'https://example.social/@reas' },
    ],
  });
  assert.equal(ParseAndValidateRefManifest(full).refVersion, '1.1.0');
  // A 1.0.0 artist — name/id/url only — stays valid: the bump is additive and
  // url, though deprecated, is still accepted.
  ParseAndValidateRefManifest(withArtist({ name: 'A', id: '', url: 'https://a.example' }));

  // Each rejection violates exactly one schema constraint, so it stops
  // failing only when that constraint drops out of the schema.
  for (const bad of [
    { name: 'A', addresses: [''] },
    { name: 'A', biographies: [{ source: 'DAM' }] },
    { name: 'A', biographies: [{ text: '' }] },
    { name: 'A', links: [{ type: 'twitter' }] },
    { name: 'A', links: [{ type: 'twitter', url: '@REAS' }] },
    { name: 'A', links: [{ type: 'mastodon', url: 'https://example.social/@a' }] },
    { name: 'A', avatar: { w: 512, h: 512 } },
  ]) {
    assert.throws(
      () => ParseAndValidateRefManifest(withArtist(bad)),
      isCode(ErrorCode.RefManifestInvalid),
      JSON.stringify(bad)
    );
  }
});

test('ParseAndValidateChannel', () => {
  assert.throws(() => ParseAndValidateChannel(Buffer.from('{}')), isCode(ErrorCode.ChannelInvalid));
});

test('ParseAndValidate_decodeErrors', () => {
  assert.throws(() => ParseAndValidatePlaylist(Buffer.from('{')), isPlaylistInvalid);
  assert.throws(() => ParseAndValidatePlaylistGroup(Buffer.from('{')));
  assert.throws(() => ParseAndValidateRefManifest(Buffer.from('{')));
  assert.throws(() => ParseAndValidateChannel(Buffer.from('{')));
});

test('ParseDPVersion', () => {
  assert.deepEqual(ParseDPVersion('1.2.3'), { major: 1, minor: 2, patch: 3, raw: '1.2.3' });
  assert.throws(() => ParseDPVersion('01.2.3'));
});

test('WarnMajorMismatch', () => {
  assert.equal(WarnMajorMismatch(ParseDPVersion('1.2.3'), 1), null);
  assert.throws(() => WarnMajorMismatch(ParseDPVersion('2.0.0'), 1));
});

test('CodeFromValidationWrappers', () => {
  const wrapped = codeFromValidation(ErrorCode.PlaylistInvalid, ErrValidation);
  assert.equal((wrapped as { code?: string } | undefined)?.code, ErrorCode.PlaylistInvalid);
});

test('CodedError_and_WithCode', () => {
  const err = withCode(ErrorCode.PlaylistInvalid, new Error('boom'));
  assert.equal((err as { code?: string } | undefined)?.code, ErrorCode.PlaylistInvalid);
});

test('read path picks the schema from the playlist fields, as build() does', () => {
  const built = new PlaylistBuilder()
    .title('Dynamic')
    .dynamicQuery({
      profile: 'https-json-v1',
      endpoint: 'https://example.com/items',
      responseMapping: { itemsPath: 'items', itemSchema: 'dp1/1.1' },
    })
    .build();
  const unsigned = { requireSignatures: false };
  assert.deepEqual(parsePlaylist(built, unsigned), built);
  assert.equal(parseDP1Playlist(built, unsigned).error, null);
  const signed = { ...built, signature: `ed25519:${'0'.repeat(128)}` };
  assert.deepEqual(ParseAndValidatePlaylist(JSON.stringify(signed)), signed);
  assert.deepEqual(ParseAndValidatePlaylist(Buffer.from(JSON.stringify(signed))), signed);

  // Empty items is only allowed together with dynamicQuery.
  const { dynamicQuery: _dq, ...noQuery } = signed;
  assert.throws(() => ParseAndValidatePlaylist(JSON.stringify(noQuery)));

  // Extension and content-rating fields are held to their schemas.
  const base = {
    dpVersion: '1.1.0',
    title: 'x',
    items: [{ source: 'https://a' }],
  };
  assert.equal(parseDP1Playlist(base, unsigned).error, null);
  for (const bad of [
    { ...base, openAt: '2026-01-01' },
    { ...base, visibility: 7 },
    { ...base, items: [{ source: 'https://a', displayAt: 7 }] },
    { ...base, items: [{ source: 'https://a', contentRating: 7 }] },
    { ...base, openAt: '2026-01-01', items: [{ source: 'https://a', contentRating: 'general' }] },
    { ...base, items: [null] },
  ]) {
    assert.ok(parseDP1Playlist(bad, unsigned).error, JSON.stringify(bad));
  }
});
