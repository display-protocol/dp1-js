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
  /** Playlists extension overlay (§3.7); same shape as ref-manifest `metadata.artists`. */
  artists?: Artist[];
  /** Playlists extension overlay (§3.7); same shape as ref-manifest `metadata.thumbnails`. */
  thumbnails?: Thumbnails;
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

/** Size-keyed thumbnail collection (`small`, `large`, `xlarge`, `default`, or any other key). */
export type Thumbnails = Record<string, Thumbnail>;

export interface Artist {
  name: string;
  id?: string;
  url?: string;
}

export interface Metadata {
  title?: string;
  artists?: Artist[];
  creditLine?: string;
  description?: string;
  tags?: string[];
  thumbnails?: Thumbnails;
}

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
  i18n?: Record<string, Metadata>;
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
