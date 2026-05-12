import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  Playlist,
  PlaylistWithPlaylistsExtension,
  PlaylistGroup,
  RefManifest,
  ChannelsExtension,
  PlaylistsExtensionFragment,
  PlaylistItem,
} from '../../../src/validate/index.js';
import { ErrValidation } from '../../../src/errors.js';

test('Validators_minimalValid', () => {
  assert.doesNotThrow(() =>
    Playlist(
      Buffer.from(
        '{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
  assert.doesNotThrow(() =>
    PlaylistGroup(
      Buffer.from(
        '{"id":"385f79b6-a45f-4c1c-8080-e93a192adccc","title":"g","playlists":["https://p"],"created":"2025-01-01T00:00:00Z","signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","role":"feed","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
  assert.doesNotThrow(() =>
    RefManifest(
      Buffer.from('{"refVersion":"0.1.0","id":"r","created":"2025-01-01T00:00:00Z","locale":"en"}')
    )
  );
  assert.doesNotThrow(() =>
    ChannelsExtension(
      Buffer.from(
        '{"id":"385f79b6-a45f-4c1c-8080-e93a192adccc","slug":"s","title":"c","version":"1.0.0","created":"2025-01-01T00:00:00Z","playlists":["https://p"],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
  assert.doesNotThrow(() => PlaylistsExtensionFragment(Buffer.from('{"summary":"x"}')));
  assert.doesNotThrow(() => PlaylistItem(Buffer.from('{"source":"https://example.com/a"}')));
  assert.doesNotThrow(() =>
    PlaylistWithPlaylistsExtension(
      Buffer.from(
        '{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}],"summary":"x","signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
});

test('Playlist_MissingSignature', () => {
  assert.throws(() =>
    Playlist(Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}'))
  );
});

test('Playlist_validationFailures', () => {
  assert.throws(() =>
    Playlist(
      Buffer.from(
        '{"title":"x","items":[{"source":"https://a"}],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
  assert.throws(() =>
    Playlist(
      Buffer.from(
        '{"dpVersion":"1.1.0","title":"","items":[{"source":"https://a"}],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
  assert.throws(() =>
    Playlist(
      Buffer.from(
        '{"dpVersion":"1.0","title":"x","items":[{"source":"https://a"}],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
  assert.throws(() =>
    Playlist(
      Buffer.from(
        '{"dpVersion":"1.1.0","title":"x","items":[],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
  assert.throws(() =>
    Playlist(
      Buffer.from(
        '{"dpVersion":"1.1.0","title":"x","items":[{}],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
});

test('PlaylistGroup_validationFailures', () => {
  assert.throws(() =>
    PlaylistGroup(
      Buffer.from(
        '{"title":"g","playlists":["https://p"],"created":"2025-01-01T00:00:00Z","signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","role":"feed","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
  assert.throws(() =>
    PlaylistGroup(
      Buffer.from(
        '{"id":"not-uuid","title":"g","playlists":["https://p"],"created":"2025-01-01T00:00:00Z","signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","role":"feed","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
});

test('RefManifest_validationFailures', () => {
  assert.throws(() =>
    RefManifest(Buffer.from('{"id":"r","created":"2025-01-01T00:00:00Z","locale":"en"}'))
  );
  assert.throws(() =>
    RefManifest(
      Buffer.from('{"refVersion":"0.1","id":"r","created":"2025-01-01T00:00:00Z","locale":"en"}')
    )
  );
});

test('ChannelsExtension_validationFailures', () => {
  assert.throws(() =>
    ChannelsExtension(
      Buffer.from(
        '{"id":"x","slug":"bad slug","title":"c","version":"1.0.0","created":"2025-01-01T00:00:00Z","playlists":["https://p"],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
});

test('PlaylistsExtensionFragment_validationFailures', () => {
  assert.throws(() => PlaylistsExtensionFragment(Buffer.from('{"summary":""}')));
});

test('PlaylistItem_OK_and_invalid', () => {
  assert.doesNotThrow(() => PlaylistItem(Buffer.from('{"source":"https://example.com/a"}')));
  assert.throws(() => PlaylistItem(Buffer.from('{}')), err => {
    if (!(err instanceof Error)) return false;
    const details = (err as { details?: unknown }).details;
    return (
      err.cause === ErrValidation &&
      Array.isArray(details) &&
      typeof details[0] === 'object' &&
      details[0] !== null &&
      'path' in details[0] &&
      'message' in details[0]
    );
  });
});
