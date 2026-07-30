# Changelog

All notable changes to this project are documented here.

## Unreleased

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
