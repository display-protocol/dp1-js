// DP-1 Core Types based on specification and OpenAPI schema

export interface DisplayPrefs {
  scaling?: 'fit' | 'fill' | 'stretch' | 'auto';
  margin?: number | string;
  background?: string;
  autoplay?: boolean;
  loop?: boolean;
  interaction?: {
    keyboard?: string[];
    mouse?: {
      click?: boolean;
      scroll?: boolean;
      drag?: boolean;
      hover?: boolean;
    };
  };
}

export interface Repro {
  engineVersion: Record<string, string>;
  seed?: string;
  assetsSHA256: string[];
  frameHash: {
    sha256: string;
    phash?: string;
  };
}

export interface Provenance {
  type: 'onChain' | 'seriesRegistry' | 'offChainURI';
  contract?: {
    chain: 'evm' | 'tezos' | 'bitmark' | 'other';
    standard?: 'erc721' | 'erc1155' | 'fa2' | 'other';
    address?: string;
    seriesId?: number | string;
    tokenId?: string;
    uri?: string;
    metaHash?: string;
  };
  dependencies?: Array<{
    chain: 'evm' | 'tezos' | 'bitmark' | 'other';
    standard?: 'erc721' | 'erc1155' | 'fa2' | 'other';
    uri: string;
  }>;
}

export interface PlaylistItem {
  id: string;
  title?: string;
  source: string;
  duration: number;
  license: 'open' | 'token' | 'subscription';
  ref?: string;
  override?: Record<string, unknown>;
  display?: DisplayPrefs;
  repro?: Repro;
  provenance?: Provenance;
  created: string;
}

export interface Playlist {
  dpVersion: string;
  id: string;
  slug: string;
  title: string;
  created?: string;
  defaults?: {
    display?: DisplayPrefs;
    license?: 'open' | 'token' | 'subscription';
    duration?: number;
  };
  items: PlaylistItem[];
  signature?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

// Crypto types for ed25519 signing
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}
