# dp1-js

A lightweight JavaScript SDK for parsing, validating, and signing DP-1 playlists in both Node.js and browser environments.

## Overview

`dp1-js` provides the foundation for DP-1 tooling and FF1 apps to verify playlist structure and optionally sign playlists with Ed25519 private keys. It creates detached signatures compatible with DP-1's `signatures[]` evolution, enabling secure and verifiable digital display protocols.

## Features

- **Parse & Validate** - Parse JSON and validate DP-1 playlist structure with detailed error reporting
- **Sign Playlists** - Create Ed25519 signatures using RFC 8785 JSON canonicalization
- **Universal** - Works in both Node.js (22+) and modern browsers
- **Type-Safe** - Full TypeScript support with comprehensive type definitions
- **Standards Compliant** - Implements DP-1 specification with RFC 8785 canonicalization

## Installation

```bash
npm install dp1-js
```

## Quick Start

### Parsing & Validating a Playlist

```typescript
import { parseDP1Playlist } from 'dp1-js';

// Parse and validate playlist JSON
const result = parseDP1Playlist(jsonData);

if (result.error) {
  console.error('Validation failed:', result.error.message);
  // Access detailed error information
  result.error.details?.forEach(detail => {
    console.error(`  ${detail.path}: ${detail.message}`);
  });
} else {
  console.log('Valid playlist:', result.playlist);
}
```

### Signing a Playlist

```typescript
import { signDP1Playlist } from 'dp1-js';

const playlist = {
  dpVersion: "1.0.0",
  id: "playlist-123",
  slug: "my-playlist",
  title: "My Playlist",
  items: [
    {
      id: "item-1",
      title: "Artwork 1",
      source: "https://example.com/artwork1.html",
      duration: 30,
      license: "open",
      created: "2025-01-01T00:00:00Z"
    }
  ]
};

// Sign with Ed25519 private key (as hex string or Uint8Array)
const signature = await signDP1Playlist(
  playlist,
  privateKeyHex // or privateKeyBytes as Uint8Array
);

console.log('Signature:', signature);
// Output: "ed25519:0x<hex_signature>"

// Add signature to playlist
const signedPlaylist = {
  ...playlist,
  signature
};
```

## API Reference

### `parseDP1Playlist(json: unknown): DP1PlaylistParseResult`

Parses and validates playlist data from unknown JSON input.

**Parameters:**
- `json` - Unknown JSON data to parse and validate

**Returns:** `DP1PlaylistParseResult` object containing either:
- `playlist` - The validated `Playlist` object (if successful)
- `error` - Detailed error information (if validation failed)
  - `type`: `"invalid_json"` | `"validation_error"`
  - `message`: Human-readable error message
  - `details`: Array of specific validation errors with paths

**Example:**
```typescript
const result = parseDP1Playlist(data);
if (result.playlist) {
  // Use validated playlist
  console.log(result.playlist.title);
}
```

### `signDP1Playlist(playlist: Omit<Playlist, "signature">, privateKey: Uint8Array | string): Promise<string>`

Signs a playlist using Ed25519 as per DP-1 specification.

**Parameters:**
- `playlist` - Playlist object without signature field
- `privateKey` - Ed25519 private key as hex string or Uint8Array

**Returns:** Promise resolving to signature string in format `"ed25519:0x<hex>"`

**Example:**
```typescript
const sig = await signDP1Playlist(playlist, "0x1234...");
```

## Types

The library exports comprehensive TypeScript types for DP-1 playlists:

```typescript
import type {
  Playlist,
  PlaylistItem,
  DisplayPrefs,
  Provenance,
  Repro,
  DP1PlaylistParseResult
} from 'dp1-js';
```

### Core Types

- **`Playlist`** - Complete playlist structure with metadata and items
- **`PlaylistItem`** - Individual item in a playlist
- **`DisplayPrefs`** - Display preferences for artwork rendering
- **`Provenance`** - On-chain or off-chain provenance information
- **`Repro`** - Reproduction and verification metadata

See [types.ts](./src/types.ts) for complete type definitions.

## Playlist Structure

A valid DP-1 playlist includes:

```typescript
{
  dpVersion: "1.0.0",           // DP-1 protocol version
  id: "unique-id",              // Unique playlist identifier
  slug: "url-friendly-slug",    // URL-friendly identifier
  title: "Playlist Title",      // Human-readable title
  created?: "ISO-8601-date",    // Optional creation timestamp
  defaults?: {                  // Optional default settings
    display?: {...},
    license?: "open" | "token" | "subscription",
    duration?: 30
  },
  items: [...],                 // Array of playlist items
  signature?: "ed25519:0x..."   // Optional Ed25519 signature
}
```

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

Builds ESM, CJS, and TypeScript declaration files to `dist/`.

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## Requirements

- **Node.js**: 22+ (uses native `node:crypto` with Ed25519 support)
- **Browsers**: Modern browsers with Web Crypto API support

## How It Works

1. **Parsing & Validation**: Uses [Zod](https://zod.dev/) schemas to validate playlist structure against DP-1 specification
2. **Canonicalization**: Implements RFC 8785 JSON canonicalization for deterministic signing
3. **Signing**: Uses Ed25519 signatures via Web Crypto API (available in Node 22+ and modern browsers)
4. **SHA-256 Hashing**: Creates hash of canonical JSON before signing

## License

MPL-2.0 © Feral File

## Contributing

Contributions are welcome! Please ensure:
- All tests pass (`npm test`)
- Code follows the existing style (`npm run lint`)
- TypeScript types are properly defined

## Related

- [DP-1 Specification](https://github.com/display-protocol/dp1) - Official DP-1 protocol specification
- [Feral File](https://feralfile.com) - Digital art platform using DP-1

## Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/feralfile/dp1-js/issues)
- Check the [DP-1 specification](https://github.com/display-protocol/dp1) for protocol details
