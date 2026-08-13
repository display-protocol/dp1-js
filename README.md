# dp1-js

[![Lint](https://github.com/display-protocol/dp1-js/actions/workflows/lint.yml/badge.svg)](https://github.com/display-protocol/dp1-js/actions/workflows/lint.yml)
[![Test](https://github.com/display-protocol/dp1-js/actions/workflows/test.yml/badge.svg)](https://github.com/display-protocol/dp1-js/actions/workflows/test.yml)

Node.js SDK for the [DP-1 protocol](https://github.com/display-protocol/dp1), kept intentionally dependency-light.

## Overview

`dp1-js` provides parsing, validation, canonicalization, hashing, and signing helpers for DP-1 playlists, playlist groups, ref manifests, and Feral File channel documents.

It is designed for Node.js 22+ and ships dual ESM/CJS entrypoints through the package root.

## Features

- Parse and validate DP-1 playlist, playlist-group, ref manifest, and channel documents.
- Schema-validate unsigned drafts via `Validate*` helpers (`requireSignatures: false`).
- Build DP-1 documents and leaf structures with fluent builders backed by AJV schemas.
- Canonicalize signing payloads using RFC 8785-style JSON canonicalization.
- Compute and verify payload hashes and signatures (Ed25519, and EIP-191 wallet signatures).
- Merge display preferences with DP-1 resolution order.
- Resolve playlist `displayAt` schedules into an active playback set and next timer.

## Install

```bash
npm install dp1-js
```

## Quick Start

### Build a playlist and validate unsigned

```ts
import { PlaylistBuilder, PlaylistItemBuilder, NoteBuilder } from 'dp1-js';

const playlist = new PlaylistBuilder()
  .title('Draft show')
  .addItem(new PlaylistItemBuilder().source('https://example.com/a.html'))
  .note(new NoteBuilder().text('Intermission').durationSeconds(20))
  .build();
```

`build()` schema-validates an unsigned document (`requireSignatures: false`). Required fields still must be set — omitting `title` / channel `slug` fails AJV. When omitted, document builders generate stable `id` and `created` on first `build()` (persisted on the builder). Document builders also cover playlist groups, channels, and ref manifests.

`format: uri` follows AJV/`ajv-formats` (absolute URIs, including non-`http(s)` schemes). Runtime fetch policies (for example dynamicQuery) may still reject non-HTTP endpoints.

### Parse and validate a playlist

```ts
import { ParseAndValidatePlaylist } from 'dp1-js';

const rawPlaylist = JSON.stringify({
  dpVersion: '1.1.0',
  title: 'Example Playlist',
  items: [
    {
      source: 'https://example.com/artwork.html',
    },
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

const playlist = ParseAndValidatePlaylist(rawPlaylist);

console.log(playlist.title);
```

### Parse and validate a channel

```ts
import { ParseAndValidateChannel } from 'dp1-js';

const rawChannel = JSON.stringify({
  id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
  slug: 'example-channel',
  title: 'Example Channel',
  version: '1.0.0',
  created: '2025-01-01T00:00:00Z',
  playlists: ['https://example.com/playlist-1.json'],
  signatures: [
    {
      alg: 'ed25519',
      kid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      ts: '2025-01-01T00:00:00Z',
      payload_hash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      role: 'feed',
      sig: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  ],
});

const channel = ParseAndValidateChannel(rawChannel);

console.log(channel.title);
```

### Sign and verify a playlist (legacy v1.0.x)

`ParseAndValidatePlaylist` requires either a v1.1.0 `signatures` array or a legacy v1.0.x `signature` field. Use `ValidatePlaylist(raw, { requireSignatures: false })` to schema-validate an unsigned draft before signing. Signing helpers operate on the **unsigned** JSON payload (without signature fields):

```ts
import { signDP1Playlist, verifyPlaylistSignature } from 'dp1-js';

const rawPlaylist = JSON.stringify({
  dpVersion: '1.0.0',
  title: 'Example Playlist',
  items: [
    {
      source: 'https://example.com/artwork.html',
    },
  ],
});

const privateKey = '0x...';
const publicKey = Buffer.from('...');

const signature = signDP1Playlist(rawPlaylist, privateKey);

verifyPlaylistSignature(rawPlaylist, signature, publicKey);

console.log(signature);
console.log('Signature verified');
```

For v1.1.0 multi-signature documents, use `SignMultiEd25519` / `VerifyPlaylistSignatures` from the signing API after schema-validating the unsigned payload (`ValidatePlaylist(raw, { requireSignatures: false })`).

### Schedule playback with `displayAt`

When at least one playlist item includes `displayAt`, only the current release window should play. Use these helpers to filter items and arm a timer for the next release:

```ts
import { computeActiveSet, nextDisplayAt, parseDisplayAt } from 'dp1-js';

const playlist = {
  dpVersion: '1.1.0',
  title: 'Daily',
  items: [
    { source: 'https://example.com/intro.html' },
    { source: 'https://example.com/day1.html', displayAt: '2026-07-21T00:00:00' },
    { source: 'https://example.com/day2.html', displayAt: '2026-07-22T00:00:00' },
    { source: 'https://example.com/day3.html', displayAt: '2026-07-23T00:00:00' },
  ],
};

const now = new Date('2026-07-22T10:00:00Z');
const active = computeActiveSet(playlist, now, 'Asia/Bangkok');
const next = nextDisplayAt(playlist, now, 'Asia/Bangkok');
const release = parseDisplayAt('2026-07-22T00:00:00', 'Asia/Bangkok');

console.log(active.map(item => item.source));
console.log(next?.toISOString());
console.log(release.toISOString());
```

Timezone rules (Playlist Extension §3.5.2):

- With `Z` or a colon offset (`+07:00`) → absolute instant
- Without timezone → display-locale wall time (`localTimezone`, or the device timezone)
- Date-only (`2026-07-21`) and compact offsets (`+0700`) are **not** accepted
- DST gap → first valid local instant after the gap; fold → earlier of the two instants

`parseDisplayAt` throws on malformed input. `computeActiveSet` / `nextDisplayAt` skip unresolvable `displayAt` values (not eligible, not a timer candidate) per §3.5.5.

## API Notes

- `parseDP1Playlist(json)` returns a `{ playlist, error }` result for already-parsed JSON input (shape-only; not full schema).
- `ValidatePlaylist(data, options?)` runs AJV against the core playlist schema. `requireSignatures` defaults to `true`; set `false` for unsigned drafts. Accepts `Buffer`, JSON string, or a parsed object.
- `ValidatePlaylistGroup`, `ValidateChannel`, and `ValidatePlaylistWithPlaylistsExtension` use the same `requireSignatures` option.
- Leaf helpers such as `ValidateNote`, `ValidateEntity`, `ValidateDisplayPrefs`, `ValidateProvenanceBlock`, `ValidateLocalizedMetadata`, and `ValidateRefManifest` run AJV against the matching schema / `$defs` (builders use these on `build()`).
- `PlaylistItemBuilder` carries the playlists-extension item fields: `.note()`, `.displayAt()`, and `.inlineManifest(manifest | RefManifestBuilder)`. Setting any of them validates the item against the composed core + extension schema instead of core alone, so a malformed inline manifest fails at `build()`.
- `RefManifestBuilder` covers the whole manifest: `.metadata(MetadataBuilder)`, `.controls(ControlsBuilder)`, and `.i18n({ locale: LocalizedMetadataBuilder })` / `.addLocalized(locale, …)`. `MetadataBuilder` has `.artists()` / `.addArtist()` and `.thumbnails()` / `.addThumbnail(key, …)`; `LocalizedMetadataBuilder` covers the three localizable fields (`title`, `description`, `creditLine`).
- Leaf builders (`NoteBuilder`, `DisplayPrefsBuilder`, …) and document builders (`PlaylistBuilder`, `PlaylistGroupBuilder`, `ChannelBuilder`, `RefManifestBuilder`, `PlaylistItemBuilder`) are exported from the package root. Builder `Playlist`/`PlaylistItem` draft shapes stay internal to avoid colliding with the looser parse types exported as `Playlist` / `PlaylistItem`.
- `ParseAndValidatePlaylist(data)` and `ParseAndValidateChannel(data)` accept raw JSON as `Buffer` or string and require signatures (multi-sig or legacy).
- `signDP1Playlist(raw, privateKey)` returns a legacy `ed25519:<hex>` signature string for v1.0.x playlists.
- `verifyPlaylistSignature(raw, signature, publicKey)` throws if verification fails.
- `SignMultiEIP191(raw, privateKey, chainID, role, ts)` signs with `personal_sign` semantics and emits the Ethereum-standard 65-byte `r || s || v` signature (`v` = 27/28), base64url-encoded, with a `did:pkh:eip155:<chainID>:<address>` `kid`. Verification accepts `v` of either 27/28 (wallets) or 0/1 (`dp1-go`), so signatures interoperate with wallets and the Go reference in both directions.
- `ParseDPVersion(version)` is available for version parsing and major-version checks.
- `DisplayForItem(def, ref, item)` merges display preferences using the same field-level overlay order as `dp1-go`.
- `parseDisplayAt(displayAt, localTimezone?)` parses item release times with the timezone rules above; throws on malformed input.
- `parseDisplayAtNanoseconds(displayAt, localTimezone?)` returns the exact epoch nanoseconds used by the scheduler; use it when sub-millisecond release times matter.
- `computeActiveSet(playlist, now, localTimezone?)` activates `displayAt` scheduling whenever at least one item has that field; otherwise it returns all items. `now` accepts a `Date` (millisecond precision) or epoch-nanoseconds `bigint` for exact sub-millisecond scheduling. Unresolvable `displayAt` values are skipped.
- `nextDisplayAt(playlist, now, localTimezone?)` returns the soonest future resolvable `displayAt`. With `bigint` `now`, it returns epoch nanoseconds; with `Date` `now`, it returns a `Date` rounded up to avoid early timers.

## Validation parity with dp1-go

Embedded JSON Schema files under `src/schema/` are kept in sync with [`display-protocol/dp1-go`](https://github.com/display-protocol/dp1-go) (`internal/schema/`). Payloads that passed validation under older, looser schemas may now fail — for example invalid `license` values or provenance blocks without `type`.

Thumbnail dimensions are the one place the schema has since been _loosened_ ([display-protocol/dp1#44](https://github.com/display-protocol/dp1/pull/44)): `w` and `h` are optional on a `Thumbnail` (only `uri` is required), so a producer holding a bare thumbnail URL omits them rather than guessing. When present they are still validated as integers ≥ 1. Every document that validated before still validates, but consumers must treat `w` / `h` as possibly absent.

The item-level `displayAt` field follows the Playlist Extension v0.2.0 overlay (display-protocol/dp1 PR [#37](https://github.com/display-protocol/dp1/pull/37)); it is optional and ignored by older runtimes. `playlist.schedule` is not part of this extension.

Item-level `inlineManifest` follows the same overlay (display-protocol/dp1 PR [#38](https://github.com/display-protocol/dp1/pull/38)): a complete Ref Manifest carried on the item instead of behind a `ref` URL, for playlists with nowhere to host a manifest document. Same schema and validation as a ref-fetched manifest, and integrity comes from the playlist signature, so no `refHash` is needed. When an item has both, a consumer resolves `ref` first; this library stores what you give it and does not drop either.

Both validation paths enforce it: the per-item overlay lives in a single `$defs/PlaylistItemExtension` shared by `playlist_with_extension.json` and `playlist_item_with_extension.json`, so `ValidatePlaylistItemWithPlaylistsExtension` checks a nested manifest exactly as whole-playlist validation does. (The single-item schema used to omit `inlineManifest`; fixed upstream in [display-protocol/dp1#46](https://github.com/display-protocol/dp1/pull/46), reported from this SDK as [dp1#45](https://github.com/display-protocol/dp1/issues/45).)

See [CHANGELOG.md](./CHANGELOG.md) for breaking validation changes.

## Repo Layout

The repository keeps a familiar module structure in JS:

- `src/playlist`
- `src/playlistgroup`
- `src/refmanifest`
- `src/merge`
- `src/sign`
- `src/jcs`
- `src/extension/*`

## Development

```bash
npm install
npm run lint
npm run type-check
npm test
```

## Requirements

- Node.js 22+
- npm for dependency installation

## Notes

- This rewrite is intentionally dependency-light.
