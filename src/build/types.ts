// These interfaces intentionally mirror the DP-1 JSON Schemas under src/schema/.
// Builders are the primary surface; types exist for consumer ergonomics and composition.

export type DPVersionString = `${number}.${number}.${number}`;

export type LicenseMode = 'open' | 'token' | 'subscription';

export type DisplayScaling = 'fit' | 'fill' | 'stretch' | 'auto';

export type Margin = number | `${number}${'px' | '%' | 'vw' | 'vh'}`;

export type Chain = 'evm' | 'tezos' | 'bitmark' | 'other';

export type TokenStandard = 'erc721' | 'erc1155' | 'fa2' | 'other';

export type ProvenanceType = 'onChain' | 'seriesRegistry' | 'offChainURI';

export interface MouseInteraction {
  click?: boolean;
  scroll?: boolean;
  drag?: boolean;
  hover?: boolean;
}

export interface InteractionPrefs {
  keyboard?: string[];
  mouse?: MouseInteraction;
}

export interface DisplayPrefs {
  scaling?: DisplayScaling;
  margin?: Margin;
  background?: string | 'transparent';
  autoplay?: boolean;
  loop?: boolean;
  interaction?: InteractionPrefs;
  userOverrides?: Record<string, boolean>;
}

export interface ReproEngineVersion {
  chromium?: string;
  webkit?: string;
  gecko?: string;
}

export interface ReproFrameHash {
  sha256?: string;
  phash?: string;
}

export interface ReproBlock {
  engineVersion?: ReproEngineVersion;
  seed?: string;
  assetsSHA256?: string[];
  frameHash?: ReproFrameHash;
}

export interface Contract {
  chain?: Chain;
  standard?: TokenStandard;
  address?: string;
  seriesId?: number;
  tokenId?: string;
  uri?: string;
  metaHash?: string;
}

export interface Dependency {
  chain?: Chain;
  standard?: TokenStandard;
  uri?: string;
}

export interface ProvenanceBlock {
  type: ProvenanceType;
  contract?: Contract;
  dependencies?: Dependency[];
}

export interface PlaylistItem {
  id?: string;
  slug?: string;
  title?: string;
  source: string;
  duration?: number;
  license?: LicenseMode;
  ref?: string;
  override?: Record<string, unknown>;
  display?: DisplayPrefs;
  repro?: ReproBlock;
  provenance?: ProvenanceBlock;
  /** Playlists extension overlay. */
  note?: Note;
  /** Playlists extension overlay (release schedule). */
  displayAt?: string;
  /**
   * Playlists extension overlay (§3.6): a full Ref Manifest carried inline instead of
   * behind `ref`. Same schema and validation as a ref-fetched manifest; when both are
   * present, `ref` wins.
   */
  inlineManifest?: RefManifest;
}

export interface Defaults {
  display?: DisplayPrefs;
  license?: LicenseMode;
  duration?: number;
}

export type SignatureAlg = 'ed25519' | 'eip191' | 'ecdsa-secp256k1' | 'ecdsa-p256';

export type SignatureRole = 'curator' | 'feed' | 'agent' | 'institution' | 'licensor';

export interface Signature {
  alg: SignatureAlg;
  kid: string;
  ts: string;
  payload_hash: string;
  role: SignatureRole;
  sig: string;
}

// Channel schema alone permits "publisher" on signatures; keep playlist/group roles narrower.
export type ChannelSignatureRole = SignatureRole | 'publisher';

export interface ChannelSignature extends Omit<Signature, 'role'> {
  role: ChannelSignatureRole;
}

export interface Playlist {
  dpVersion: DPVersionString;
  id?: string;
  title: string;
  slug?: string;
  created?: string;
  defaults?: Defaults;
  items: PlaylistItem[];
  signatures?: Signature[];
  signature?: string;
  // playlists extension overlay
  note?: Note;
  curators?: Entity[];
  summary?: string;
  coverImage?: string;
  dynamicQuery?: DynamicQuery;
}

/**
 * @deprecated The DP-1 spec removed the Playlist-Group (Exhibition) object
 * (display-protocol/dp1#41): channels superseded it before it saw production use, and
 * zero groups were ever published. Use the channels extension instead
 * (`ChannelBuilder`, `ValidateChannel`, `VerifyChannelSignatures`). Retained for
 * backward compatibility and dp1-go parity; scheduled for removal in the next major.
 */
export interface PlaylistGroup {
  id: string;
  slug?: string;
  title: string;
  curator?: string;
  summary?: string;
  playlists: string[];
  created: string;
  coverImage?: string;
  signatures?: Signature[];
  signature?: string;
}

export interface Entity {
  name: string;
  key: string;
  url?: string;
}

export interface Note {
  text: string;
  duration?: number;
}

export type DynamicQueryProfile = 'https-json-v1' | 'graphql-v1';

export interface ResponseMapping {
  itemsPath: string;
  itemSchema: string;
  itemMap?: Record<string, string>;
}

export interface DynamicQuery {
  profile: DynamicQueryProfile;
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  query?: string;
  responseMapping: ResponseMapping;
}

// Ref manifest

export interface Thumbnail {
  uri: string;
  /** Intrinsic width in pixels. Optional: omitted when the producer only holds a bare URL. */
  w?: number;
  /** Intrinsic height in pixels. Optional: omitted when the producer only holds a bare URL. */
  h?: number;
  sha256?: string;
}

/** `links[].type` as the schema enumerates it; anything else is rejected — use `'other'`. */
export type LinkType = 'website' | 'twitter' | 'instagram' | 'other';

/** External profile link. `url` is always a full URL, never a bare handle. */
export interface Link {
  type: LinkType;
  url: string;
}

/** One biographical text with optional attribution. `text` is plain text, no markup. */
export interface Biography {
  text: string;
  source?: string;
  sourceUrl?: string;
}

/**
 * A creator and, from refVersion 1.1.0, a profile snapshot taken when the manifest was
 * authored (spec §4.1).
 *
 * Identity: only `addresses` may be used to recognize the same artist across producers.
 * `id` is producer-scoped (two producers label one artist with different ids) and `name`
 * is display text. `addresses` is a signed claim of the producer, not a fact — a wallet
 * can be shared by a collective or a collaborative mint — so a consumer must not merge
 * two artist records merely because their address lists intersect.
 *
 * `avatar`, `biographies` and `links` are the offline fallback, not the source of truth;
 * a consumer may overlay fresher registry data keyed by `addresses`.
 */
export interface Artist {
  name: string;
  /** Opaque, producer-scoped label. Not an identity. */
  id?: string;
  /**
   * The refVersion 1.0.0 single profile URL.
   *
   * @deprecated Superseded by `links` (write an entry of type `'website'`). Still valid
   * on the wire; a producer that emits both must keep `url` equal to that entry.
   * Consumers read `links` first and fall back to `url` only when `links` is absent or
   * empty.
   */
  url?: string;
  /**
   * Raw wallet addresses (EVM `0x…`, Tezos `tz1…tz4`). Contract addresses (Tezos
   * `KT1…`, EVM collection contracts) name a collection, not a person, and must not be
   * listed — they belong in `provenance.contract`.
   */
  addresses?: string[];
  /** Portrait or profile image; same shape as a thumbnail. */
  avatar?: Thumbnail;
  /** Ordered by the producer's preference; when only one fits, show the first. */
  biographies?: Biography[];
  links?: Link[];
}

export interface Metadata {
  title?: string;
  artists?: Artist[];
  creditLine?: string;
  description?: string;
  tags?: string[];
  thumbnails?: Record<string, Thumbnail>;
}

/**
 * Localized text overrides carried under `i18n`. Narrower than `Metadata`:
 * the schema localizes only these three fields.
 */
export interface LocalizedMetadata {
  title?: string;
  description?: string;
  creditLine?: string;
}

/**
 * `LocalizedMetadata` at a write boundary, with the `Metadata`-only fields closed off.
 *
 * Needed because `LocalizedMetadata`'s fields are all optional, which makes `Metadata`
 * structurally assignable to it. TypeScript's excess-property check fires only on fresh
 * object literals, so `i18n({ fr: someMetadataVariable })` would otherwise compile even
 * though `artists` / `tags` / `thumbnails` have no localized meaning in the schema. The
 * `never` fields are guards, not schema fields — `LocalizedMetadata` above is the model
 * that mirrors `$defs/LocalizedMetadata`.
 */
export type LocalizedMetadataOverride = LocalizedMetadata & {
  artists?: never;
  tags?: never;
  thumbnails?: never;
};

export interface DisplayControls {
  scaling?: DisplayScaling;
  margin?: Margin;
  background?: string | 'transparent';
  autoplay?: boolean;
  loop?: boolean;
  interaction?: InteractionPrefs;
}

export interface SafetyControls {
  orientation?: Array<'landscape' | 'portrait' | 'any'>;
  maxCpuPct?: number;
  maxMemMB?: number;
}

export interface Controls {
  display?: DisplayControls;
  safety?: SafetyControls;
}

export interface RefManifest {
  refVersion: DPVersionString;
  id: string;
  created: string;
  locale: string;
  metadata?: Metadata;
  controls?: Controls;
  i18n?: Record<string, LocalizedMetadataOverride>;
}

// Channel document (channels extension)

export interface Channel {
  id: string;
  slug: string;
  title: string;
  version: DPVersionString;
  created: string;
  playlists: string[];
  curators?: Entity[];
  publisher?: Entity;
  summary?: string;
  coverImage?: string;
  signatures?: ChannelSignature[];
  signature?: string;
}
