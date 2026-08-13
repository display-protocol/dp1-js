# dp1-js

[![Lint](https://github.com/display-protocol/dp1-js/actions/workflows/lint.yml/badge.svg)](https://github.com/display-protocol/dp1-js/actions/workflows/lint.yml)
[![Test](https://github.com/display-protocol/dp1-js/actions/workflows/test.yml/badge.svg)](https://github.com/display-protocol/dp1-js/actions/workflows/test.yml)

Node.js SDK for the [DP-1 protocol](https://github.com/display-protocol/dp1), kept intentionally dependency-light.

## Overview

`dp1-js` provides parsing, validation, canonicalization, hashing, and signing helpers for DP-1 playlists, playlist groups, ref manifests, and Feral File channel documents.

It is designed for Node.js 22+ and ships dual ESM/CJS entrypoints through the package root. Schema validation is precompiled at package build time, so it also runs on Node-compatible runtimes that forbid dynamic code generation — Cloudflare Workers being the tested one (see [Edge runtimes](#edge-runtimes-cloudflare-workers)).

## Features

- Parse and validate DP-1 playlist, ref manifest, and channel documents (plus deprecated playlist-group, see below).
- Schema-validate unsigned drafts via `Validate*` helpers (`requireSignatures: false`).
- Build DP-1 documents and leaf structures with fluent builders backed by AJV schemas, precompiled so no schema is compiled at runtime.
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
- `ValidateChannel` and `ValidatePlaylistWithPlaylistsExtension` use the same `requireSignatures` option, as does the deprecated `ValidatePlaylistGroup`.
- Leaf helpers such as `ValidateNote`, `ValidateEntity`, `ValidateDisplayPrefs`, `ValidateProvenanceBlock`, `ValidateLocalizedMetadata`, and `ValidateRefManifest` run AJV against the matching schema / `$defs` (builders use these on `build()`).
- `PlaylistItemBuilder` carries the playlists-extension item fields: `.note()`, `.displayAt()`, and `.inlineManifest(manifest | RefManifestBuilder)`. Setting any of them validates the item against the composed core + extension schema instead of core alone, so a malformed inline manifest fails at `build()`.
- `RefManifestBuilder` covers the whole manifest: `.metadata(MetadataBuilder)`, `.controls(ControlsBuilder)`, and `.i18n({ locale: LocalizedMetadataBuilder })` / `.addLocalized(locale, …)`. The `i18n` write sites take `LocalizedMetadataOverride` — `LocalizedMetadata` with `artists` / `tags` / `thumbnails` closed off — so a full `Metadata` value cannot stand in for a locale override; reading back gives you a plain `LocalizedMetadata`. `MetadataBuilder` has `.artists()` / `.addArtist()` and `.thumbnails()` / `.addThumbnail(key, …)`; `LocalizedMetadataBuilder` covers the three localizable fields (`title`, `description`, `creditLine`).
- Leaf builders (`NoteBuilder`, `DisplayPrefsBuilder`, …) and document builders (`PlaylistBuilder`, `ChannelBuilder`, `RefManifestBuilder`, `PlaylistItemBuilder`, and the deprecated `PlaylistGroupBuilder`) are exported from the package root. Builder `Playlist`/`PlaylistItem` draft shapes stay internal to avoid colliding with the looser parse types exported as `Playlist` / `PlaylistItem`.
- `ParseAndValidatePlaylist(data)` and `ParseAndValidateChannel(data)` accept raw JSON as `Buffer` or string and require signatures (multi-sig or legacy).
- `signDP1Playlist(raw, privateKey)` returns a legacy `ed25519:<hex>` signature string for v1.0.x playlists.
- `verifyPlaylistSignature(raw, signature, publicKey)` throws if verification fails.
- `SignMultiEIP191(raw, privateKey, chainID, role, ts)` signs with `personal_sign` semantics and emits the Ethereum-standard 65-byte `r || s || v` signature (`v` = 27/28), base64url-encoded, with a `did:pkh:eip155:<chainID>:<address>` `kid`. Verification accepts `v` of either 27/28 (wallets) or 0/1 (`dp1-go`), so signatures interoperate with wallets and the Go reference in both directions.
- `ParseDPVersion(version)` is available for version parsing and major-version checks.
- `DisplayForItem(def, ref, item)` merges display preferences using the same field-level overlay order as `dp1-go`. It takes a single manifest slot, so with both `ref` and `inlineManifest` present the caller chooses which to pass; the spec's order is `defaults → inlineManifest → ref → item.local`, so to honour it fully, call once with the inline manifest and again with the fetched one, feeding the first result forward as `def`.
- `parseDisplayAt(displayAt, localTimezone?)` parses item release times with the timezone rules above; throws on malformed input.
- `parseDisplayAtNanoseconds(displayAt, localTimezone?)` returns the exact epoch nanoseconds used by the scheduler; use it when sub-millisecond release times matter.
- `computeActiveSet(playlist, now, localTimezone?)` activates `displayAt` scheduling whenever at least one item has that field; otherwise it returns all items. `now` accepts a `Date` (millisecond precision) or epoch-nanoseconds `bigint` for exact sub-millisecond scheduling. Unresolvable `displayAt` values are skipped.
- `nextDisplayAt(playlist, now, localTimezone?)` returns the soonest future resolvable `displayAt`. With `bigint` `now`, it returns epoch nanoseconds; with `Date` `now`, it returns a `Date` rounded up to avoid early timers.

## Edge runtimes (Cloudflare Workers)

Validation never compiles a schema at runtime. AJV normally builds each validator with `new Function(...)` on first use, which throws `Code generation from strings disallowed for this context` on workerd and other runtimes that disable dynamic codegen — and only there, so a green Node test run says nothing about it ([#24](https://github.com/display-protocol/dp1-js/issues/24)). The schemas are instead compiled to plain JavaScript ([AJV standalone](https://ajv.js.org/standalone.html)) when the package is built, so validation, every builder's `build()`, and every `ParseAndValidate*` work unchanged on Workers.

The Worker still needs Node compatibility, as it always has: the package root reaches `node:crypto`, `node:net`, and `node:dns` through the signing and playlist modules, and `Buffer` is used throughout. Enable it in `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
```

That is the configuration the smoke test runs, and the only one this package is verified on — the library stays Node-targeted, so a plain browser (no Node globals, no `node:` specifiers) is still out of reach regardless of how validation is compiled.

AJV is a build-time dependency only; installing `dp1-js` pulls in `@noble/curves` and `@noble/hashes` and nothing else. `npm run smoke:workerd` runs the package inside `wrangler dev --local` and asserts both an accepted and a rejected document; it also runs in CI.

## Schema provenance and parity

Embedded JSON Schema files under `src/schema/` track the specification repository, [`display-protocol/dp1`](https://github.com/display-protocol/dp1) — `core/v1.1.0/schemas/` and `extensions/` — and are kept byte-identical to it. Payloads that passed validation under older, looser schemas may fail — for example invalid `license` values or provenance blocks without `type`.

**Parity with dp1-go is currently partial.** The Go SDK's `internal/schema/` has not yet picked up two spec changes that this SDK has, so the two implementations disagree on these cases:

| Case                                          | dp1-js   | dp1-go                                 |
| :-------------------------------------------- | :------- | :------------------------------------- |
| `Thumbnail` with `uri` only, no `w` / `h`     | accepted | rejected (`required: ["uri","w","h"]`) |
| Single item with a malformed `inlineManifest` | rejected | accepted (overlay omits the field)     |

Both differences are dp1-js following the current spec, so they should close when dp1-go syncs. Until then, do not assume a document accepted here is accepted by the Go reference. `src/schema/core/playlist-group.json` is the exception to the provenance rule above: the spec removed the Playlist-Group object ([dp1#41](https://github.com/display-protocol/dp1/pull/41)), so that file has no upstream counterpart and is retained from dp1-go for backward compatibility.

### Playlist-Group is deprecated

The DP-1 spec removed the Playlist-Group (Exhibition) object in [dp1#41](https://github.com/display-protocol/dp1/pull/41) — channels superseded it before it saw production use, and per the spec, zero groups were ever published. Every Playlist-Group export here is now marked `@deprecated`: `parsePlaylistGroup`, `PlaylistGroupDocument`, `PlaylistGroupBuilder`, `ValidatePlaylistGroup`, `ParseAndValidatePlaylistGroup`, `VerifyPlaylistGroupSignatures`, `SchemaHooks.PlaylistGroupSchemaValidate`, `ErrorCode.PlaylistGroupInvalid`, and the `PlaylistGroup` type.

Nothing has changed at runtime — existing documents still parse, validate, and verify exactly as before. Use the channels extension (`ChannelBuilder`, `ValidateChannel`, `VerifyChannelSignatures`) for new work. Removal is deferred to a major release, ideally coordinated with `dp1-go`, which still ships the object; dropping it here alone would open a fresh parity gap.

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

Validators are generated from `src/schema/*.json` into `src/validate/generated/` by `npm run generate:validators`, which `build`, `test`, and `type-check` run first (and `npm install` triggers through `prepare`). The generated files are build artifacts: they are gitignored, and a schema change is picked up by regenerating, never by editing them. The generator also derives the `-unsigned` schema variants that `{ requireSignatures: false }` validates against, so those stay in step with the signed ones.

`npm run smoke:workerd` builds the package, installs it into a throwaway Worker, and exercises it under `wrangler dev --local` (needs network access for the wrangler install).

## Requirements

- Node.js 22+
- npm for dependency installation

## Notes

- This rewrite is intentionally dependency-light.
