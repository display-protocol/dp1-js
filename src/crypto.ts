import { webcrypto } from 'node:crypto';
import canonicalize from 'canonicalize';
import type { Playlist } from './types';

/**
 * Cryptographic utilities for DP-1 protocol
 */

// Use node:crypto's webcrypto for Cloudflare Workers compatibility
const crypto = webcrypto;

/**
 * Convert hex string to Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.replace(/^0x/, '');

  // Ensure even length
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Create canonical form of playlist for signing (RFC 8785 compliant)
 * Uses the canonicalize library which implements the official RFC 8785 standard
 */
export function createCanonicalForm(playlist: Omit<Playlist, 'signature'>): string {
  // Use the canonicalize library which is RFC 8785 compliant
  const canonical = canonicalize(playlist);

  if (!canonical) {
    throw new Error('Failed to canonicalize playlist');
  }

  // Add LF terminator if it's not present
  if (!canonical.endsWith('\n')) {
    return canonical + '\n';
  }

  return canonical;
}

/**
 * Sign a playlist using ed25519 as per DP-1 specification
 */
export async function signDP1Playlist(
  playlist: Omit<Playlist, 'signature'>,
  privateKey: Uint8Array | string
): Promise<string> {
  const canonicalForm = createCanonicalForm(playlist);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalForm);

  // Hash with SHA-256 first
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert private key to Uint8Array if it's a string
  const privateKeyBytes = typeof privateKey === 'string' ? hexToUint8Array(privateKey) : privateKey;

  // Import the private key for signing
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    {
      name: 'Ed25519',
      namedCurve: 'Ed25519',
    },
    false,
    ['sign']
  );

  // Sign the hash
  const signature = await crypto.subtle.sign('Ed25519', cryptoKey, hashBuffer);
  const signatureBytes = new Uint8Array(signature);

  // Convert to hex and format as per DP-1 spec
  const hex = Array.from(signatureBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `ed25519:0x${hex}`;
}

/**
 * Verify a playlist signature
 */
export async function verifyPlaylistSignature(
  playlist: Playlist,
  publicKey: Uint8Array
): Promise<boolean> {
  if (!playlist.signature) {
    return false;
  }

  try {
    // Extract hex from signature
    const signatureHex = playlist.signature.replace(/^ed25519:0x/, '');
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []
    );

    // Create canonical form without signature
    const playlistWithoutSignature = { ...playlist };
    delete playlistWithoutSignature.signature;
    const canonicalForm = createCanonicalForm(playlistWithoutSignature);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalForm);

    // Hash with SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Import public key for verification
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      publicKey,
      {
        name: 'Ed25519',
        namedCurve: 'Ed25519',
      },
      false,
      ['verify']
    );

    // Verify signature
    return await crypto.subtle.verify('Ed25519', cryptoKey, signatureBytes, hashBuffer);
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
