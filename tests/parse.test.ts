import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  parseDP1Playlist,
  ParseAndValidatePlaylist,
  ParseAndValidatePlaylistWithPlaylistsExtension,
  ParseAndValidatePlaylistGroup,
  ParseAndValidateRefManifest,
  ParseAndValidateChannel,
  ParseDPVersion,
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
  const res = parseDP1Playlist({
    dpVersion: '1.0.0',
    title: 'x',
    items: [{ source: 'https://example.com' }],
  });
  assert.equal(res.error, null);
});

test('parseDP1Playlist_returnsDetailsOnFailure', () => {
  const res = parseDP1Playlist({
    dpVersion: '1.0.0',
    title: 'x',
    items: [{}],
  });
  assert.equal(res.playlist, null);
  assert.equal(res.error?.message.startsWith('dp1: playlist item.source must be a string'), true);
  assert.equal(res.error?.details.length, 1);
  assert.deepEqual(res.error?.details[0], {
    path: '/',
    message: 'dp1: playlist item.source must be a string',
  });
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
