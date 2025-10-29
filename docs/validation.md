## DP-1 Playlist Validation Reference

Human-readable summary of validations defined in `src/schema.ts`.

### dpVersion validation (function)

- **Input**: string
- **Rules**:
  - Must be a valid semantic version.
  - Must be greater than or equal to `1.0.0`.
- **Errors**:
  - `Invalid semantic version format: <value>`
  - `dpVersion <value> is below minimum required version 1.0.0`

### DisplayPrefsSchema (optional object)

- The whole `display` object is optional; all fields within it are optional.
- **scaling**: one of `fit | fill | stretch | auto`.
- **margin**:
  - number: ≥ 0, or
  - string: matches `^[0-9]+(\.[0-9]+)?(px|%|vw|vh)$`.
    - Examples: `"10px"`, `"5%"`, `"1.5vw"`, `"0vh"`.
- **background**: hex color (`#rgb` or `#rrggbb`) or `transparent`.
- **autoplay**: boolean.
- **loop**: boolean.
- **interaction** (optional object):
  - **keyboard**: string[] (optional)
  - **mouse** (optional object): `click | scroll | drag | hover` (booleans, all optional)

### ReproSchema (optional object)

- **engineVersion**: `Record<string, string>` (required)
- **seed**: string, regex `^0x[a-fA-F0-9]+$`, max 130 (optional)
- **assetsSHA256**: string[], max 1024 entries (required)
  - each item: regex `^0x[a-fA-F0-9]+$`, max 66
- **frameHash** (required object):
  - **sha256**: string, regex `^0x[a-fA-F0-9]+$`, max 66
  - **phash**: string, regex `^0x[a-fA-F0-9]+$`, max 18 (optional)

### ProvenanceSchema (optional object)

- **type**: one of `onChain | seriesRegistry | offChainURI`.
- **contract** (optional object):
  - **chain**: `evm | tezos | bitmark | other` (required within contract)
  - **standard**: `erc721 | erc1155 | fa2 | other` (optional)
  - **address**: string, max 48 (required within contract)
  - **seriesId**: number `0..4294967295` or string max 128 (conditionally required; see below)
  - **tokenId**: string, max 128 (conditionally required; see below)
  - **uri**: string, URI-like regex `^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$`, max 1024 (optional)
  - **metaHash**: string, regex `^0x[a-fA-F0-9]+$`, max 66 (optional)
- **dependencies**: array (max 1024) of objects (optional):
  - **chain**: `evm | tezos | bitmark | other`
  - **standard**: `erc721 | erc1155 | fa2 | other` (optional)
  - **uri**: string, URI-like regex as above, max 1024
- **Conditional rules**:
  - If `type` is `onChain` or `seriesRegistry`, then `contract` is required.
    - Error: `contract is required when provenance on chain or in series registry`
  - If `type` is `onChain`:
    - `contract.tokenId` is required.
      - Error: `contract.tokenId is required when provenance type is onChain`
  - If `type` is `seriesRegistry`:
    - `contract.seriesId` is required.
      - Error: `contract.seriesId is required when provenance type is seriesRegistry`
  - If `type` is `offChainURI`, then `contract` must NOT be present.
    - Error: `contract is not allowed when provenance is off chain URI`

### PlaylistItemSchema (object)

- **id**: string, UUID
- **title**: string, max 256 (optional)
- **source**: string, URI-like regex, max 1024
- **duration**: number, min 1
- **license**: `open | token | subscription`
- **ref**: string, URI-like regex, max 1024 (optional)
- **override**: `Record<string, unknown>` (optional)
- **display**: `DisplayPrefsSchema` (optional)
- **repro**: `ReproSchema` (optional)
- **provenance**: `ProvenanceSchema` (optional)
- **created**: string, ISO datetime

### PlaylistSchema (top-level object)

- **dpVersion**: string, max 16, refined via `validateDpVersion` (see above)
- **id**: string, UUID
- **slug**: string, regex `^[a-zA-Z0-9-]+$`, max 64
- **title**: string, max 256
- **created**: string, ISO datetime
- **defaults** (optional object):
  - **display**: `DisplayPrefsSchema` (optional)
  - **license**: `open | token | subscription` (optional)
  - **duration**: number, min 1 (optional)
- **items**: `PlaylistItemSchema[]`, min 1, max 1024
- **signature**: string, regex `^ed25519:0x[a-fA-F0-9]+$`, max 150

---

If this document diverges from the source, the source of truth is `src/schema.ts`.
