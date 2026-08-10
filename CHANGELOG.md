# Changelog

All notable changes to this project are documented here.

## Unreleased

### Changed

- `EthereumAddressToDIDPKH` now emits the address in EIP-55 mixed-case checksum form instead of all-lowercase, matching `dp1-go`. Both implementations now produce byte-identical `did:pkh` `kid` strings for the same key, so a consumer comparing a signature's `kid` against a stored identifier (for example `curators[].key`) no longer has to normalize casing first. `EthereumAddressFromDIDPKH` returns the checksummed form regardless of input casing.
- `EthereumAddressFromDIDPKH` rejects a mixed-case address whose EIP-55 checksum does not validate, rather than trusting it. All-lowercase addresses remain accepted, as in `dp1-go`. `EthereumAddressToDIDPKH` also rejects a non-positive `chainID`.
- Signature verification is unaffected: recovered addresses were already compared case-insensitively, in both this library and `dp1-go`.

## 2.2.0 — 2026-08-10

### Fixed

- `eip191` verification now parses the Ethereum-standard `r(32) || s(32) || v(1)` signature layout (with `v` normalized from 27/28 to 0/1) instead of noble's recovery-first `recovery || r || s` format. Signatures produced by wallets (`personal_sign` / `eth_sign`) and by `dp1-go` previously failed with `invalid recovery id`, so every wallet-signed document verified as invalid.

### Changed (breaking: eip191 signature wire format)

- `NewEthereumSigner` / `SignMultiEIP191` now emit the Ethereum-standard `r || s || v` layout instead of noble's `recovery || r || s`. That layout is what both wallets and `dp1-go` use; the emitted recovery-id convention is the wallet one, `v` = 27/28 (`dp1-go` emits 0/1, and its verifier normalizes any `v` ≥ 27, so it accepts ours). The previous output was only ever verifiable by dp1-js itself, so the incompatibility runs both ways: eip191 signatures produced by dp1-js ≤ 2.1.0 no longer verify and need re-signing, and signatures produced by this version are rejected by dp1-js ≤ 2.1.0. Pin consistent versions across producers and verifiers. Verification accepts `v` of 0/1 or 27/28, so `dp1-go`-produced signatures are unaffected in either direction.

## 2.1.0 — 2026-07-30

### Added

- `ValidatePlaylist`, `ValidatePlaylistGroup`, `ValidateChannel`, and `ValidatePlaylistWithPlaylistsExtension` accept `{ requireSignatures?: boolean }` (default `true`) so unsigned drafts can be schema-checked before signing.
- Leaf AJV helpers (`ValidateNote`, `ValidateEntity`, `ValidateDisplayPrefs`, `ValidateProvenanceBlock`, …) and fluent builders for leaf blocks and documents (`NoteBuilder`, `PlaylistBuilder`, `ChannelBuilder`, …) exported from the package root.
- Regression tests for stricter validation and merge parity edge cases.
- Playlist Extension scheduling helpers: `parseDisplayAt`, `computeActiveSet`, and `nextDisplayAt` (aligned with Playlist Extension §3.5 / v0.2.0).
- Playlist item type and schema overlay support for item-level `displayAt` (v0.2.0 `$id`s). Scheduling activates automatically when any item includes `displayAt`; `playlist.schedule` is not part of the extension.

### Changed

- Embedded JSON Schema files now match `display-protocol/dp1-go` (`internal/schema/`). Validation is stricter and aligned with the Go reference SDK.
- `DisplayForItem` merge uses field-level overlay semantics from `dp1-go/merge` instead of shallow object assignment.

### Validation (breaking for previously loose payloads)

- `license` must be one of `open`, `token`, or `subscription` when present on playlist items or defaults.
- `provenance.type` is required; `onChain` and `seriesRegistry` require a `contract` object.
- `repro` fields use pattern constraints (for example `seed`, `assetsSHA256`, `frameHash`).
- Ref manifest schema validates structured `metadata`, `controls`, and thumbnail dimensions.
- Channel schema `$id` is `extensions/channels/v1.0.0`; signature role `publisher` is accepted.
