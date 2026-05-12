import {
  createPrivateKey,
  createPublicKey,
  sign as nodeSign,
  verify as nodeVerify,
} from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { CodedError, ErrNoSignatures, ErrSigInvalid, ErrUnsupportedAlg } from '../errors.js';
import { payloadHashString, verifyPayloadHash, signingDigest } from './payload.js';

export { payloadHashString as PayloadHashString, verifyPayloadHash as VerifyPayloadHash };

export const RoleCurator = 'curator';
export const RoleFeed = 'feed';
export const RoleAgent = 'agent';
export const RoleInstitution = 'institution';
export const RoleLicensor = 'licensor';

export const AlgEd25519 = 'ed25519';
export const AlgEIP191 = 'eip191';
export const AlgECDSASecp256k1 = 'ecdsa-secp256k1';
export const AlgECDSAP256 = 'ecdsa-p256';

const didKeyPrefix = 'did:key:';
const didPkhPrefix = 'did:pkh:eip155:';
const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

type Verifier = {
  alg(): string;
  verifySignature(kid: string, sigBytes: Uint8Array, digest: Uint8Array): void;
};
type Signer = { alg(): string; sign(digest: Uint8Array): [string, Uint8Array] };
type PrivateKeyLike = Parameters<typeof createPrivateKey>[0];
type PublicKeyLike = Parameters<typeof createPublicKey>[0];
type SignatureLike = { alg: string; kid: string; sig: string; payload_hash: string };

const verifiers = new Map<string, Verifier>();

export function RegisterVerifier(v: Verifier) {
  verifiers.set(String(v.alg()).toLowerCase(), v);
}

export function GetVerifier(alg: string) {
  const v = verifiers.get(String(alg).toLowerCase());
  if (!v) throw new Error(`${ErrUnsupportedAlg.message}: "${alg}"`);
  return v;
}

export function SupportedAlgorithms() {
  return [...verifiers.keys()].sort();
}

export function SignMulti(raw: Buffer | string, signer: Signer, role: string, ts: string) {
  const digest = signingDigest(raw);
  const payload_hash = payloadHashString(raw);
  const [kid, sigBytes] = signer.sign(digest);
  return {
    alg: signer.alg(),
    kid,
    ts,
    payload_hash,
    role,
    sig: Buffer.from(sigBytes).toString('base64url'),
  };
}

function ensureBuffer(value: Buffer | Uint8Array | string) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

function ensurePrivateKey(key: PrivateKeyLike | { type?: string } | null | undefined) {
  if (key && typeof key === 'object' && 'type' in key) {
    return key;
  }

  if (typeof key === 'string') {
    const raw = normalizePrivateKeyBytes(key);
    return createPrivateKey({ key: raw, format: 'der', type: 'pkcs8' });
  }

  if (Buffer.isBuffer(key) || key instanceof Uint8Array) {
    return createPrivateKey({ key: Buffer.from(key), format: 'der', type: 'pkcs8' });
  }

  return createPrivateKey(key as Parameters<typeof createPrivateKey>[0]);
}

function normalizePrivateKeyBytes(value: string) {
  const trimmed = value.trim();
  const base64Like = /^[A-Za-z0-9+/=_-]+$/.test(trimmed);
  const hexLike = /^(0x)?[0-9a-fA-F]+$/.test(trimmed);

  if (hexLike) {
    const clean = trimmed.replace(/^0x/, '');
    return Buffer.from(clean, 'hex');
  }

  if (base64Like) {
    return Buffer.from(trimmed, 'base64');
  }

  throw new Error('invalid private key encoding');
}

function ed25519PublicKeyObjectFromRaw(raw: Buffer | Uint8Array) {
  const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), ensureBuffer(raw)]);
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

export function Ed25519DIDKey(pub: Buffer | Uint8Array) {
  const key = ensureBuffer(pub);
  if (key.length !== 32) throw new Error(`ed25519 public key must be 32 bytes, got ${key.length}`);
  return `${didKeyPrefix}z${encodeBase58btc(Buffer.from(Uint8Array.from([0xed, 0x01, ...key])))}`;
}

export function Ed25519PublicKeyFromDIDKey(kid: string) {
  if (!String(kid).toLowerCase().startsWith(didKeyPrefix))
    throw new Error('kid must use did:key form');
  const multibase = String(kid).slice(didKeyPrefix.length);
  if (!multibase.startsWith('z')) throw new Error('did:key must use multibase base58btc');
  const data = decodeBase58btc(multibase.slice(1));
  if (data.length !== 34 || data[0] !== 0xed || data[1] !== 0x01)
    throw new Error('did:key is not ed25519-pub multicodec');
  return data.subarray(2);
}

export function EthereumAddressToDIDPKH(addr: string, chainID: number) {
  const hex = String(addr).toLowerCase().replace(/^0x/, '');
  if (hex.length !== 40) throw new Error('invalid ethereum address');
  return `${didPkhPrefix}${chainID}:0x${hex}`;
}

export function EthereumAddressFromDIDPKH(kid: string) {
  const parts = String(kid).split(':');
  if (parts.length !== 5 || parts[0] !== 'did' || parts[1] !== 'pkh' || parts[2] !== 'eip155') {
    throw new Error('kid must use did:pkh:eip155:{chainID}:{address}');
  }
  const chainID = Number(parts[3]);
  const addr = parts[4];
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || !Number.isInteger(chainID))
    throw new Error('invalid did:pkh');
  return [addr, chainID] as const;
}

class Ed25519Verifier {
  alg() {
    return AlgEd25519;
  }
  verifySignature(kid: string, sigBytes: Uint8Array, digest: Uint8Array) {
    const pub = ed25519PublicKeyObjectFromRaw(Ed25519PublicKeyFromDIDKey(kid));
    if (sigBytes.length !== 64)
      throw new Error(
        `${ErrSigInvalid.message}: ed25519 signature must be 64 bytes, got ${sigBytes.length}`
      );
    if (!nodeVerify(null, digest, pub, sigBytes)) throw ErrSigInvalid;
  }
}

class Eip191Verifier {
  alg() {
    return AlgEIP191;
  }
  verifySignature(kid: string, sigBytes: Uint8Array, digest: Uint8Array) {
    const [addr] = EthereumAddressFromDIDPKH(kid);
    if (sigBytes.length !== 65)
      throw new Error(
        `${ErrSigInvalid.message}: ethereum signature must be 65 bytes, got ${sigBytes.length}`
      );
    const msg = keccak_256(
      Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n32'), Buffer.from(digest)])
    );
    const sig = Uint8Array.from(sigBytes);
    const pub = secp256k1.recoverPublicKey(sig, msg, { prehash: false });
    const recoveredPub = secp256k1.Point.fromBytes(pub).toBytes(false);
    const recovered = `0x${bytesToHex(keccak_256(recoveredPub.subarray(1)).subarray(-20))}`;
    if (recovered.toLowerCase() !== addr.toLowerCase()) throw ErrSigInvalid;
  }
}

RegisterVerifier(new Ed25519Verifier());
RegisterVerifier(new Eip191Verifier());

export function NewEd25519Signer(
  privateKey: PrivateKeyLike | { type?: string } | null | undefined
) {
  const key = ensurePrivateKey(privateKey);
  return {
    alg: () => AlgEd25519,
    sign: (digest: Uint8Array): [string, Uint8Array] => {
      const sig = nodeSign(null, digest, key as Parameters<typeof nodeSign>[2]);
      const publicKey = createPublicKey(key as Parameters<typeof createPublicKey>[0])
        .export({ format: 'der', type: 'spki' })
        .subarray(-32);
      return [Ed25519DIDKey(publicKey), sig];
    },
  };
}

export function NewEthereumSigner(privateKey: Uint8Array | Buffer | string, chainID: number) {
  return {
    alg: () => AlgEIP191,
    sign: (digest: Uint8Array): [string, Uint8Array] => {
      const msg = keccak_256(
        Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n32'), Buffer.from(digest)])
      );
      const sig = secp256k1.sign(msg, privateKey as Parameters<typeof secp256k1.sign>[1], {
        format: 'recovered',
        prehash: false,
      });
      const pub = secp256k1.getPublicKey(
        privateKey as Parameters<typeof secp256k1.getPublicKey>[0],
        false
      );
      const addr = `0x${bytesToHex(keccak_256(pub.subarray(1)).subarray(-20))}`;
      return [EthereumAddressToDIDPKH(addr, chainID), Buffer.from(sig)];
    },
  };
}

export async function SignMultiEd25519(
  raw: Buffer | string,
  privateKey: PrivateKeyLike | { type?: string } | null | undefined,
  role: string,
  ts: string,
  kid?: string
) {
  const sig = SignMulti(raw, NewEd25519Signer(privateKey), role, ts);
  if (kid && kid !== sig.kid) {
    throw new Error('dp1: kid override must match the Ed25519 signing key');
  }
  if (kid) sig.kid = kid;
  return sig;
}

export async function SignMultiEIP191(
  raw: Buffer | string,
  privateKey: Uint8Array | Buffer | string,
  chainID: number,
  role: string,
  ts: string
) {
  return SignMulti(raw, NewEthereumSigner(privateKey, chainID), role, ts);
}

export function SignLegacyEd25519(
  raw: Buffer | string,
  privateKey: PrivateKeyLike | { type?: string } | null | undefined
) {
  const key = ensurePrivateKey(privateKey);
  return `ed25519:${nodeSign(null, signingDigest(raw), key as Parameters<typeof nodeSign>[2]).toString('hex')}`;
}

export function VerifyLegacyEd25519(
  raw: Buffer | string,
  legacySig: string,
  pub: PublicKeyLike | Uint8Array | Buffer | string
) {
  if (!legacySig) throw new Error(`${ErrSigInvalid.message}: empty legacy signature`);
  if (!legacySig.startsWith('ed25519:'))
    throw new Error(`${ErrSigInvalid.message}: expected prefix "ed25519:"`);
  const bytes = decodeLegacySignatureBytes(legacySig.slice(8));
  if (bytes.length !== 64)
    throw new Error(`${ErrSigInvalid.message}: bad signature length ${bytes.length}`);
  if (!nodeVerify(null, signingDigest(raw), pub as Parameters<typeof nodeVerify>[2], bytes))
    throw ErrSigInvalid;
}

function decodeLegacySignatureBytes(encoded: string) {
  const trimmed = encoded.trim();
  const hex = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    return Buffer.alloc(0);
  }
  return Buffer.from(hex, 'hex');
}

export function VerifyMultiSignature(
  raw: Buffer | string,
  sig: SignatureLike,
  publicKey?: PublicKeyLike | Uint8Array | Buffer | string
) {
  verifyPayloadHash(raw, sig.payload_hash);
  const digest = signingDigest(raw);
  const verifier = GetVerifier(sig.alg);
  const sigBytes = Buffer.from(sig.sig, 'base64url');
  if (sig.alg === AlgEd25519 && publicKey) {
    if (!nodeVerify(null, digest, publicKey as Parameters<typeof nodeVerify>[2], sigBytes))
      throw ErrSigInvalid;
    return true;
  }
  return verifier.verifySignature(sig.kid, sigBytes, digest);
}

export function VerifyMultiEd25519(raw: Buffer | string, sig: SignatureLike) {
  if (String(sig.alg).toLowerCase() !== AlgEd25519)
    throw new CodedError(ErrUnsupportedAlg.message, `"${sig.alg}"`);
  return VerifyMultiSignature(raw, sig);
}

function decodeBase58btc(input: string) {
  if (!input) return Buffer.alloc(0);

  let value = 0n;
  for (const char of input) {
    const digit = base58Alphabet.indexOf(char);
    if (digit < 0) {
      throw new Error('did:key must use multibase base58btc');
    }
    value = value * 58n + BigInt(digit);
  }

  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }

  let leadingZeros = 0;
  for (const char of input) {
    if (char !== '1') break;
    leadingZeros++;
  }

  return Buffer.from([...new Array(leadingZeros).fill(0), ...bytes]);
}

function encodeBase58btc(input: Buffer | Uint8Array) {
  const bytes = Buffer.from(input);
  if (bytes.length === 0) return '';

  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }

  let out = '';
  while (value > 0n) {
    const rem = Number(value % 58n);
    out = base58Alphabet[rem] + out;
    value /= 58n;
  }

  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    leadingZeros++;
  }

  return `${'1'.repeat(leadingZeros)}${out}`;
}

export function VerifyMultiSignaturesJSON(raw: Buffer | string) {
  const envelope = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  if (!Array.isArray(envelope.signatures) || envelope.signatures.length === 0)
    throw ErrNoSignatures;
  const failed = [];
  for (const sig of envelope.signatures) {
    try {
      VerifyMultiSignature(raw, sig);
    } catch {
      failed.push(sig);
    }
  }
  return [failed.length === 0, failed.length ? failed : null, null] as const;
}

export function VerifyPlaylistSignatures(raw: Buffer | string) {
  return VerifyMultiSignaturesJSON(raw);
}
export function VerifyPlaylistGroupSignatures(raw: Buffer | string) {
  return VerifyMultiSignaturesJSON(raw);
}
export function VerifyChannelSignatures(raw: Buffer | string) {
  return VerifyMultiSignaturesJSON(raw);
}

export const signDP1Playlist = SignLegacyEd25519;
export const verifyPlaylistSignature = VerifyLegacyEd25519;

export async function verifyPlaylist(
  playlist: Record<string, unknown>,
  publicKey: PublicKeyLike | Uint8Array | Buffer | string
) {
  if (!playlist || typeof playlist !== 'object') {
    throw new Error('playlist must be an object');
  }

  if (Array.isArray((playlist as { signatures?: unknown[] }).signatures)) {
    const verifyFn = VerifyPlaylistSignatures;
    const [ok] = verifyFn(Buffer.from(JSON.stringify(playlist)));
    return ok;
  }

  const legacySig = String((playlist as { signature?: unknown }).signature || '');
  if (!legacySig) {
    return false;
  }
  if (!publicKey) {
    return false;
  }

  const rawPlaylist = { ...playlist };
  delete rawPlaylist.signature;
  delete rawPlaylist.signatures;
  VerifyLegacyEd25519(Buffer.from(JSON.stringify(rawPlaylist)), legacySig, publicKey);
  return true;
}
