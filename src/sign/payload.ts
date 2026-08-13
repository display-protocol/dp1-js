import { sha256 } from '@noble/hashes/sha2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { transform } from '../jcs/index.js';
import {
  asBytes,
  bytesToHex,
  concatBytes,
  toText,
  utf8ToBytes,
  type BinaryLike,
  type Bytes,
} from '../runtime/bytes.js';
import { ed25519PublicKeyBytes, ed25519SecretKeyBytes, type Ed25519KeyLike } from './keys.js';

function stripSignatureFields(raw: BinaryLike) {
  const obj = JSON.parse(toText(raw));
  delete obj.signature;
  delete obj.signatures;
  return JSON.stringify(obj);
}

export function canonicalPayload(raw: BinaryLike): Bytes {
  return transform(stripSignatureFields(raw));
}

export function signingMessage(raw: BinaryLike): Bytes {
  const canon = canonicalPayload(raw);
  return asBytes(concatBytes(canon, utf8ToBytes('\n')));
}

export function signingDigest(raw: BinaryLike): Bytes {
  return asBytes(sha256(signingMessage(raw)));
}

export function payloadHashString(raw: BinaryLike) {
  return `sha256:${bytesToHex(signingDigest(raw))}`;
}

export function verifyPayloadHash(raw: BinaryLike, wantHash: string) {
  const got = payloadHashString(raw);
  if (got !== wantHash) throw new Error('payload_hash does not match canonical document digest');
}

export function signEd25519(raw: BinaryLike, privateKey: Ed25519KeyLike): Bytes {
  return asBytes(ed25519.sign(signingDigest(raw), ed25519SecretKeyBytes(privateKey)));
}

export function verifyEd25519(raw: BinaryLike, sig: Uint8Array, publicKey: Ed25519KeyLike) {
  return verifyEd25519Digest(signingDigest(raw), sig, publicKey);
}

/**
 * Ed25519 verification that answers false instead of throwing.
 *
 * `@noble/curves` rejects a malformed point or signature by throwing, where Node's
 * `crypto.verify` returned `false`. Callers here treat every such failure the same way, so
 * normalize to the boolean the call sites were already written against.
 *
 * Key normalization deliberately stays *outside* the `try`. An unusable public key is a
 * caller mistake, not a forged document; folding it in would report "invalid signature" for
 * what is really "you passed the wrong thing", which is what `node:crypto` surfaced as a
 * thrown `ERR_OSSL_*` before.
 */
export function verifyEd25519Digest(
  digest: Uint8Array,
  sig: Uint8Array,
  publicKey: Ed25519KeyLike
) {
  const point = ed25519PublicKeyBytes(publicKey);
  try {
    return ed25519.verify(sig, digest, point);
  } catch {
    return false;
  }
}

export function loadPrivateKey(key: Ed25519KeyLike): Uint8Array {
  return ed25519SecretKeyBytes(key);
}

export function loadPublicKey(key: Ed25519KeyLike): Uint8Array {
  return ed25519PublicKeyBytes(key);
}
