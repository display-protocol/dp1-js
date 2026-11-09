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

/** `display.imageRendering` / `controls.display.imageRendering` (dp1 registry 1.0.9). */
export type ImageRendering = 'auto' | 'pixelated';

export interface DisplayPrefs {
  scaling?: DisplayScaling;
  margin?: Margin;
  background?: string | 'transparent';
  autoplay?: boolean;
  loop?: boolean;
  /**
   * How raster images are resampled when scaled: `'pixelated'` keeps hard pixel edges
   * (nearest-neighbor), for pixel art and bitmaps; `'auto'` lets the player smooth.
   * Independent of `scaling`, which decides how the artwork fits.
   */
  imageRendering?: ImageRendering;
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
  /**
   * Series identifier within the contract: an integer when the contract numbers its
   * series with small values, or a decimal string (`^[0-9]+$`, as the schema's `oneOf`
   * requires) when the id is too large for a JSON number to hold exactly — for example a
   * 256-bit id — the same reason `tokenId` is a string.
   */
  seriesId?: number | string;
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
  /**
   * Content-rating extension overlay (draft, registry 1.0.7): a curatorial audience
   * label. The wire vocabulary is open — any string is a valid rating, `v0.1.0` defines
   * only `'general'` and `'mature'`, and an unrecognized value means unrated, the same
   * as absence. Use `isKnownContentRating` to branch on the values this SDK understands;
   * never to decide whether a document is valid. Only `'mature'` hides anything.
   */
  contentRating?: string;
  /**
   * Content-rating extension overlay: open-vocabulary curatorial reasons supporting
   * `contentRating`. Explanatory text, never a filtering taxonomy.
   */
  contentReasons?: string[];
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
  /**
   * When this playlist's own subject became public — an exhibition's opening, a
   * collection's release (dp1#55). Reuses the `displayAt` wire shape (local or absolute
   * datetime; date-only rejected) for one consistent date format across DP-1, but is
   * unrelated to §3.5 displayAt Scheduling: that mechanism gates which *items* are
   * eligible to play and activates only from an item-level `displayAt`. `openAt` sets no
   * eligibility, timer, or activation. Distinct from `created` too, which is the
   * document's own issuance time and churns on every re-export; `openAt` is the
   * real-world event and does not.
   */
  openAt?: string;
  coverImage?: string;
  dynamicQuery?: DynamicQuery;
  /**
   * Editorial content about the playlist — articles, events, news — in the order to
   * show them (dp1#55). References only: the content itself stays at the URL.
   */
  links?: Link[];
  /**
   * Whether directories may list the playlist (§3.7). Values defined by this version:
   * `'public'` (the default when absent) and `'unlisted'`. A listing request, not
   * access control — an unlisted playlist is still served to anyone with its address.
   * Directories treat any value other than exactly `'public'` as unlisted.
   */
  visibility?: string;
  /**
   * Smaller playlists published around this one — a burn record, a memento run, a
   * catalog or launch-party edition — named here on the parent and rendered as sections
   * of this playlist's page (§3.8, dp1#62/#63). Each satellite stays a complete,
   * independent playlist and a member of `channel.playlists[]` in its own right;
   * `satellites[]` only changes how a browsing consumer presents it.
   */
  satellites?: Satellite[];
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

// `Entity` is defined below, once `Thumbnail` / `Biography` / `Link` exist for it to
// reference (dp1 registry 1.0.9 Entity consolidation; see the "Ref manifest" section).

export interface Note {
  text: string;
  duration?: number;
  /** Heading shown above `text` (1–200 characters). */
  title?: string;
  /** Who wrote `text`. Omitted, the note is the curators' own. */
  author?: Entity;
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

/**
 * `links[].type` as the schema enumerates it; anything else is rejected — use `'other'`.
 * `'profile'` is the producer's own page about the entity; `'publication'` is writing by
 * or about it; `'article'` / `'event'` / `'news'` are editorial content about a playlist
 * (dp1#55).
 */
export type LinkType =
  | 'website'
  | 'twitter'
  | 'instagram'
  | 'profile'
  | 'publication'
  | 'article'
  | 'event'
  | 'news'
  | 'other';

/**
 * External link, from an entity's profile or from a playlist. `url` is always a full
 * URL, never a bare handle. `title` / `date` / `thumbnail` / `authors` are dp1#55
 * additions for the playlist-level editorial use (an article needs a headline and a
 * byline; a profile link usually needs neither).
 */
export interface Link {
  type: LinkType;
  url: string;
  /** Human-readable label for the destination, such as a publication or article title. */
  title?: string;
  /**
   * RFC3339 timestamp the linked content refers to (an article's publish date, an
   * event's start) — not when this `Link` entry itself was written.
   */
  date?: string;
  /** Representative image for the destination: an article's cover, an event's still. */
  thumbnail?: Thumbnail;
  /**
   * Who wrote or presented the linked content, credited the way `metadata.artists[]`
   * credits a work. A producer holding one joined credit line emits a single entry
   * carrying it, as it would for a collaboration.
   */
  authors?: Entity[];
}

/**
 * A smaller playlist published around this one — a burn record, a memento run, a
 * catalog or launch-party edition — that a consumer implementing §3.8 should present as
 * a labeled section of this playlist's page rather than as a show of its own (dp1#62).
 * Independent document: its own series, id and signature; this entry only names it and
 * how to present it. The relation is named on the parent only — a satellite's own
 * playlist carries no back-reference, the same pattern `Channel.playlists[]` uses one
 * level up.
 */
export interface Satellite {
  /**
   * URI of the satellite's playlist (or the channel-relative address a consumer
   * resolves the same way it resolves any other playlist reference).
   */
  playlist: string;
  /**
   * Open vocabulary (as in `contentRating` and `visibility`): the kind of satellite
   * this is, e.g. `'burn'`, `'mementos'`, `'catalog'`, `'launch-party'`. An
   * unrecognized value is still a valid satellite, just an unlabeled one.
   */
  kind: string;
  /** Heading shown above the satellite's items, when different from a human-readable form of `kind`. */
  title?: string;
  /** One paragraph of context shown above the satellite's items. */
  note?: string;
}

/** One biographical text with optional attribution. `text` is plain text, no markup. */
export interface Biography {
  text: string;
  source?: string;
  sourceUrl?: string;
}

/** `entity.role` — disambiguates an entity's function when its position does not already
 * say it. Omitted, the role follows the position: `metadata.artists[]` is `'artist'`,
 * `curators[]` is `'curator'`, `publisher` is `'publisher'`.
 */
export type EntityRole = 'artist' | 'curator' | 'partner' | 'sponsor' | 'publisher' | 'other';

/**
 * A person or organization named by a DP-1 document: an artist credited on a work, a
 * curator or partner of a playlist or channel, a channel publisher, or the author of a
 * note (dp1 registry 1.0.9 Entity consolidation, spec §4.1). One model for every place
 * DP-1 names someone.
 *
 * Beyond `name`, the fields are a profile snapshot taken when the document was
 * authored; consumers MAY overlay fresher registry data keyed by `addresses` or `key`.
 *
 * Identity: only `addresses` may be used to recognize the same entity across producers.
 * `id` is producer-scoped (two producers label one entity with different ids), `key` is
 * a verifiable DID (informational only — never used to verify a signature), and `name`
 * is display text that MAY be empty for a wallet-based publisher. `addresses` is a
 * signed claim of the producer, not a fact — a wallet can be shared by a collective or a
 * collaborative mint — so a consumer must not merge two entity records merely because
 * their address lists intersect.
 *
 * `avatar`, `biographies` and `links` are the offline fallback, not the source of truth.
 */
export interface Entity {
  /**
   * Display name. MAY be empty: a wallet-based publisher can emit the signing identity
   * with an empty name. Consumers MUST NOT reject a document for it; display SHOULD
   * fall back to `key`.
   */
  name: string;
  /** Verifiable identity in DID format. Informational only: signatures carry their own
   * `kid`, and this field is never used to verify them. */
  key?: string;
  /** Opaque, producer-scoped label. Not an identity. */
  id?: string;
  /**
   * Legacy single profile URL.
   *
   * @deprecated Superseded by `links` (write an entry of type `'website'` or
   * `'profile'`). Still valid on the wire; a producer that emits both must keep `url`
   * equal to that entry. Consumers read `links` first and fall back to `url` only when
   * `links` is absent or empty.
   */
  url?: string;
  role?: EntityRole;
  /** Where the person or organization is based, as free text (city and country, say). */
  location?: string;
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

/**
 * An artist credited on a work. Same model as every other `Entity` — the name is kept
 * so existing references resolve, and so `metadata.artists[]` reads naturally — the
 * schema's own `Artist` is a `$ref` to `Entity` (dp1 registry 1.0.9).
 */
export type Artist = Entity;

/**
 * What the work is made of, twice over (spec §4.1, refVersion 1.2.0): `type` is the
 * filter a catalog groups by, `details` the lines a reader sees under the title.
 */
export interface Medium {
  /** Closed enumeration. Omitted when the producer does not know it. */
  type?: MediumType;
  /**
   * Short labels in display order, one fact each (format with color and sound,
   * dimensions, duration, technique, toolchain); at most eight, each 1–200 characters.
   * Consumers render them in order and must not reorder or parse them.
   */
  details?: string[];
}

export type MediumType =
  | 'image'
  | 'video'
  | 'audio'
  | 'software'
  | '3d'
  | 'animated-gif'
  | 'pdf'
  | 'text'
  | 'other';

export interface Metadata {
  title?: string;
  artists?: Artist[];
  creditLine?: string;
  description?: string;
  medium?: Medium;
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
  imageRendering?: ImageRendering;
  interaction?: InteractionPrefs;
}

export interface SafetyControls {
  orientation?: Array<'landscape' | 'portrait' | 'any'>;
  maxCpuPct?: number;
  maxMemMB?: number;
}

/** `controls.permissions` entries — device capabilities the work needs to run as intended. */
export type Permission = 'camera' | 'microphone';

export interface Controls {
  display?: DisplayControls;
  safety?: SafetyControls;
  /**
   * Device capabilities the work needs to run as intended. A player that cannot grant
   * one SHOULD NOT start the work silently; it SHOULD show why the work cannot play.
   */
  permissions?: Permission[];
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
