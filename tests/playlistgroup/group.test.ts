import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  ErrorCode,
  ParseAndValidatePlaylistGroup,
  PlaylistGroupBuilder,
  PlaylistGroupDocument,
  SchemaHooks,
  ValidatePlaylistGroup,
  VerifyPlaylistGroupSignatures,
  parsePlaylistGroup,
} from '../../src/index.js';

const sampleSignature = {
  alg: 'ed25519',
  kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  ts: '2025-01-01T00:00:00Z',
  payload_hash: 'sha256:' + 'a'.repeat(64),
  role: 'curator',
  sig: 'A'.repeat(86),
};

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

// Playlist-Group is deprecated: the DP-1 spec removed the object (display-protocol/dp1#41)
// and the exports are annotated accordingly. Deprecation is a signal, not a behaviour
// change, so pin that the whole surface still works — if any of this regresses, the
// deprecation has silently become a removal.
test('Group_deprecatedSurfaceStillFunctions', () => {
  const group = new PlaylistGroupBuilder()
    .title('Exhibition')
    .addPlaylist('https://example.com/p.json')
    .build();
  assert.equal(group.title, 'Exhibition');
  assert.match(group.id, /^[0-9a-f-]{36}$/i);

  // Unsigned drafts still validate through the requireSignatures escape hatch,
  // and signatures are still required by default.
  assert.doesNotThrow(() => ValidatePlaylistGroup(group, { requireSignatures: false }));
  assert.throws(() => ValidatePlaylistGroup(group));

  // The signed round trip still parses, and still carries its own error code.
  const signed = JSON.stringify({ ...group, signatures: [sampleSignature] });
  const parsed = ParseAndValidatePlaylistGroup(Buffer.from(signed));
  assert.equal(parsed.title, 'Exhibition');
  assert.throws(
    () => ParseAndValidatePlaylistGroup(Buffer.from('{"id":"x"}')),
    err =>
      err instanceof Error && (err as { code?: string }).code === ErrorCode.PlaylistGroupInvalid
  );

  // Signature verification still resolves through the group-specific helper.
  assert.deepEqual(VerifyPlaylistGroupSignatures(Buffer.from(signed))[0], false);

  // The schema is still registered under the hook consumers may have wired up.
  assert.doesNotThrow(() => SchemaHooks.PlaylistGroupSchemaValidate(Buffer.from(signed)));
});
