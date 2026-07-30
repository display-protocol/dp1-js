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
  PlaylistItemWithPlaylistsExtension,
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

test('ChannelsExtension_acceptsPublisherRole', () => {
  assert.doesNotThrow(() =>
    ChannelsExtension(
      Buffer.from(
        '{"id":"385f79b6-a45f-4c1c-8080-e93a192adccc","slug":"s","title":"c","version":"1.0.0","created":"2025-01-01T00:00:00Z","playlists":["https://p"],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","role":"publisher","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
});

test('Playlist_rejectsInvalidLicenseMode', () => {
  assert.throws(() =>
    Playlist(
      Buffer.from(
        '{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a","license":"invalid"}],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
});

test('Playlist_rejectsProvenanceWithoutType', () => {
  assert.throws(() =>
    Playlist(
      Buffer.from(
        '{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a","provenance":{"contract":{"chain":"evm"}}}],"signatures":[{"alg":"ed25519","kid":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","role":"curator","sig":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}'
      )
    )
  );
});

const sampleSignature = {
  alg: 'ed25519',
  kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  ts: '2025-01-01T00:00:00Z',
  payload_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  role: 'curator',
  sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

function signedPlaylist(doc: Record<string, unknown>) {
  return Buffer.from(JSON.stringify({ ...doc, signatures: [sampleSignature] }));
}

test('Playlist_acceptsLicenseModes', () => {
  for (const license of ['open', 'token', 'subscription']) {
    assert.doesNotThrow(() =>
      Playlist(
        signedPlaylist({
          dpVersion: '1.1.0',
          title: 'x',
          items: [{ source: 'https://a', license }],
        })
      )
    );
  }
});

test('Playlist_acceptsValidProvenanceOnChain', () => {
  assert.doesNotThrow(() =>
    Playlist(
      signedPlaylist({
        dpVersion: '1.1.0',
        title: 'x',
        items: [
          {
            source: 'https://a',
            provenance: { type: 'onChain', contract: { chain: 'evm', address: '0xabc' } },
          },
        ],
      })
    )
  );
});

test('Playlist_rejectsProvenanceOnChainWithoutContract', () => {
  assert.throws(() =>
    Playlist(
      signedPlaylist({
        dpVersion: '1.1.0',
        title: 'x',
        items: [{ source: 'https://a', provenance: { type: 'onChain' } }],
      })
    )
  );
});

test('Playlist_acceptsLegacySignatureField', () => {
  assert.doesNotThrow(() =>
    Playlist(
      Buffer.from(
        '{"dpVersion":"1.0.0","title":"x","items":[{"source":"https://a"}],"signature":"ed25519:ab"}'
      )
    )
  );
});

test('Playlist_rejectsInvalidReproSeed', () => {
  assert.throws(() =>
    Playlist(
      signedPlaylist({
        dpVersion: '1.1.0',
        title: 'x',
        items: [{ source: 'https://a', repro: { seed: 'not-hex' } }],
      })
    )
  );
});

test('RefManifest_acceptsMetadataWithThumbnail', () => {
  assert.doesNotThrow(() =>
    RefManifest(
      Buffer.from(
        '{"refVersion":"0.1.0","id":"r","created":"2025-01-01T00:00:00Z","locale":"en","metadata":{"title":"Work","thumbnails":{"default":{"uri":"https://example.com/t.jpg","w":320,"h":180}}}}'
      )
    )
  );
});

test('RefManifest_rejectsThumbnailMissingDimensions', () => {
  assert.throws(() =>
    RefManifest(
      Buffer.from(
        '{"refVersion":"0.1.0","id":"r","created":"2025-01-01T00:00:00Z","locale":"en","metadata":{"thumbnails":{"default":{"uri":"https://example.com/t.jpg"}}}}'
      )
    )
  );
});

test('PlaylistsExtensionFragment_validationFailures', () => {
  assert.throws(() => PlaylistsExtensionFragment(Buffer.from('{"summary":""}')));
});

test('PlaylistItem_OK_and_invalid', () => {
  assert.doesNotThrow(() => PlaylistItem(Buffer.from('{"source":"https://example.com/a"}')));
  assert.throws(
    () => PlaylistItem(Buffer.from('{}')),
    err => {
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
    }
  );
});

test('PlaylistItemWithPlaylistsExtension_OK_and_displayAt', () => {
  assert.doesNotThrow(() =>
    PlaylistItemWithPlaylistsExtension(Buffer.from('{"source":"https://example.com/a"}'))
  );
  assert.doesNotThrow(() =>
    PlaylistItemWithPlaylistsExtension(
      Buffer.from('{"source":"https://example.com/a","displayAt":"2026-07-21T00:00:00Z"}')
    )
  );
  assert.doesNotThrow(() =>
    PlaylistItemWithPlaylistsExtension(
      Buffer.from('{"source":"https://example.com/a","displayAt":"2026-07-21T00:00:00"}')
    )
  );
  assert.throws(() => PlaylistItemWithPlaylistsExtension(Buffer.from('{}')), err => {
    return err instanceof Error && err.cause === ErrValidation;
  });
  assert.throws(
    () =>
      PlaylistItemWithPlaylistsExtension(
        Buffer.from('{"source":"https://example.com/a","displayAt":null}')
      ),
    err => err instanceof Error && err.cause === ErrValidation
  );
  assert.throws(
    () =>
      PlaylistItemWithPlaylistsExtension(
        Buffer.from('{"source":"https://example.com/a","displayAt":""}')
      ),
    err => err instanceof Error && err.cause === ErrValidation
  );
  assert.throws(
    () =>
      PlaylistItemWithPlaylistsExtension(
        Buffer.from('{"source":"https://example.com/a","displayAt":"not-a-date"}')
      ),
    err => err instanceof Error && err.cause === ErrValidation
  );
  assert.throws(
    () =>
      PlaylistItemWithPlaylistsExtension(
        Buffer.from('{"source":"https://example.com/a","displayAt":"2026-07-21"}')
      ),
    err => err instanceof Error && err.cause === ErrValidation
  );
  assert.throws(
    () =>
      PlaylistItemWithPlaylistsExtension(
        Buffer.from('{"source":"https://example.com/a","displayAt":123}')
      ),
    err => err instanceof Error && err.cause === ErrValidation
  );
});
