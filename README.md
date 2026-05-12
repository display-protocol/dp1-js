# dp1-js

Node.js SDK for the [DP-1 protocol](https://github.com/display-protocol/dp1), rewritten as a JS fork of `dp1-go`.

## Purpose

This package keeps the DP-1 logic, tests, and repo structure aligned with `dp1-go` while using a minimal Node-only dependency footprint.

## What is included

- Parse and validate DP-1 playlist, playlist-group, ref manifest, and channel documents.
- Canonicalize signing payloads using RFC 8785-style JSON canonicalization.
- Compute and verify payload hashes and Ed25519 signatures.
- Merge display preferences with DP-1 resolution order.
- Provide the same top-level module boundaries as `dp1-go`.

## Runtime

- Node.js 22+
- Dual ESM/CJS package entrypoints
- Runtime dependencies are installed through npm

## Install

```bash
npm install dp1-js-test
```

## Usage

```js
import { ParseDPVersion, PayloadHashString, DisplayForItem } from 'dp1-js-test';

const version = ParseDPVersion('1.1.0');
const hash = PayloadHashString(Buffer.from(JSON.stringify({ title: 'Example', items: [] })));
```

The package root is the supported public entrypoint. Node consumers can use either
`import` or `require` thanks to the package `exports` map.

## Repo layout

The repository keeps the Go-style structure translated into JS:

- `src/playlist`
- `src/playlistgroup`
- `src/refmanifest`
- `src/merge`
- `src/sign`
- `src/jcs`
- `src/extension/*`

## Development

```bash
npm test
npm run lint
```

## Notes

- This rewrite is intentionally dependency-light.
- The JS API is aligned with `dp1-go` rather than the deprecated older `dp1-js` naming.
