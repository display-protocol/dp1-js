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
