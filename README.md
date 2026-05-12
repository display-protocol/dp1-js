# dp1-js

[![Lint](https://github.com/feral-file/dp1-js/actions/workflows/lint.yml/badge.svg)](https://github.com/feral-file/dp1-js/actions/workflows/lint.yml)
[![Test](https://github.com/feral-file/dp1-js/actions/workflows/test.yml/badge.svg)](https://github.com/feral-file/dp1-js/actions/workflows/test.yml)

Node.js SDK for the [DP-1 protocol](https://github.com/display-protocol/dp1), kept intentionally dependency-light.

## Overview

`dp1-js` provides parsing, validation, canonicalization, hashing, and signing helpers for DP-1 playlists, playlist groups, ref manifests, and Feral File channel documents.

It is designed for Node.js 22+ and ships dual ESM/CJS entrypoints through the package root.

## Features

- Parse and validate DP-1 playlist, playlist-group, ref manifest, and channel documents.
- Canonicalize signing payloads using RFC 8785-style JSON canonicalization.
- Compute and verify payload hashes and Ed25519 signatures.
- Merge display preferences with DP-1 resolution order.

## Install

```bash
npm install dp1-js
```

## Quick Start

### Parse and validate a playlist

```ts
import { ParseAndValidatePlaylist } from 'dp1-js';

const rawPlaylist = JSON.stringify({
  dpVersion: '1.0.0',
  title: 'Example Playlist',
  items: [
    {
      source: 'https://example.com/artwork.html',
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
  id: 'channel-123',
  slug: 'example-channel',
  title: 'Example Channel',
  version: '1.0.0',
  created: '2025-01-01T00:00:00Z',
  playlists: ['https://example.com/playlist-1.json'],
});

const channel = ParseAndValidateChannel(rawChannel);

console.log(channel.title);
```

### Sign and verify a playlist

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

## API Notes

- `parseDP1Playlist(json)` returns a `{ playlist, error }` result for already-parsed JSON input.
- `ParseAndValidatePlaylist(data)` and `ParseAndValidateChannel(data)` accept raw JSON as `Buffer` or string.
- `signDP1Playlist(raw, privateKey)` returns an `ed25519:...` signature string.
- `verifyPlaylistSignature(raw, signature, publicKey)` throws if verification fails.
- `ParseDPVersion(version)` is available for version parsing and major-version checks.

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
