import { ed25519 } from '@noble/curves/ed25519.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { CodedError, ErrNoSignatures, ErrSigInvalid, ErrUnsupportedAlg } from '../errors.js';
import {
  payloadHashString,
  verifyPayloadHash,
  signingDigest,
  verifyEd25519Digest,
} from './payload.js';
import {
  base64ToBytes,
  bytesToBase64Url,
  bytesToHex,
  concatBytes,
  toText,
  utf8ToBytes,
  type BinaryLike,
} from '../runtime/bytes.js';
import { decodeHexSignature, ed25519SecretKeyBytes, type Ed25519KeyLike } from './keys.js';

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
type PrivateKeyLike = Ed25519KeyLike;
type PublicKeyLike = Ed25519KeyLike;
type SignatureLike = { alg: string; kid: string; sig: string; payload_hash: string };

// EIP-191 personal_sign prefix for a 32-byte payload, shared by the signer and the verifier.
const EIP191_PREFIX = utf8ToBytes('\x19Ethereum Signed Message:\n32');

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

export function SignMulti(raw: BinaryLike, signer: Signer, role: string, ts: string) {
  const digest = signingDigest(raw);
  const payload_hash = payloadHashString(raw);
  const [kid, sigBytes] = signer.sign(digest);
  return {
    alg: signer.alg(),
    kid,
    ts,
    payload_hash,
    role,
    sig: bytesToBase64Url(sigBytes),
  };
}

export function Ed25519DIDKey(pub: Uint8Array) {
  if (pub.length !== 32) throw new Error(`ed25519 public key must be 32 bytes, got ${pub.length}`);
  return `${didKeyPrefix}z${encodeBase58btc(Uint8Array.from([0xed, 0x01, ...pub]))}`;
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

/**
 * Apply the EIP-55 mixed-case checksum to a 40-character lowercase hex address.
 * The hash is taken over the ASCII of the lowercase hex string, not the address bytes.
 */
function eip55Checksum(lowerHex: string) {
  const hash = bytesToHex(keccak_256(utf8ToBytes(lowerHex)));
  let out = '0x';
  for (let i = 0; i < lowerHex.length; i++) {
    out += parseInt(hash[i], 16) >= 8 ? lowerHex[i].toUpperCase() : lowerHex[i];
  }
  return out;
}

/**
 * Build a CAIP-10 `did:pkh:eip155:{chainID}:{address}` identifier.
 * The address is normalized to EIP-55 mixed-case checksum form, matching
 * dp1-go's `EthereumAddressToDIDPKH`, so both implementations emit byte-identical
 * `kid` strings for the same key.
 */
export function EthereumAddressToDIDPKH(addr: string, chainID: number) {
  const hex = String(addr).toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error('invalid ethereum address');
  if (!Number.isInteger(chainID) || chainID < 1)
    throw new Error(`chainID must be a positive integer, got ${chainID}`);
  return `${didPkhPrefix}${chainID}:${eip55Checksum(hex)}`;
}

/**
 * Parse a `did:pkh:eip155:{chainID}:{address}` identifier.
 * Returns the address in EIP-55 checksum form regardless of the input casing.
 * As in dp1-go, an all-lowercase address is accepted, but a mixed-case address
 * whose checksum does not validate is rejected rather than silently trusted.
 */
export function EthereumAddressFromDIDPKH(kid: string) {
  const parts = String(kid).split(':');
  if (parts.length !== 5 || parts[0] !== 'did' || parts[1] !== 'pkh' || parts[2] !== 'eip155') {
    throw new Error('kid must use did:pkh:eip155:{chainID}:{address}');
  }
  const chainID = Number(parts[3]);
  const addr = parts[4];
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || !Number.isInteger(chainID) || chainID < 1)
    throw new Error('invalid did:pkh');

  const checksummed = eip55Checksum(addr.slice(2).toLowerCase());
  if (addr !== checksummed && addr !== addr.toLowerCase())
    throw new Error(`ethereum address checksum mismatch in did:pkh: got ${addr}`);

  return [checksummed, chainID] as const;
}

class Ed25519Verifier {
  alg() {
    return AlgEd25519;
  }
  verifySignature(kid: string, sigBytes: Uint8Array, digest: Uint8Array) {
    const pub = Ed25519PublicKeyFromDIDKey(kid);
    if (sigBytes.length !== 64)
      throw new Error(
        `${ErrSigInvalid.message}: ed25519 signature must be 64 bytes, got ${sigBytes.length}`
      );
    if (!verifyEd25519Digest(digest, sigBytes, pub)) throw ErrSigInvalid;
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
    const msg = keccak_256(concatBytes(EIP191_PREFIX, digest));
    // Wallets (personal_sign / eth_sign, e.g. MetaMask) and dp1-go encode signatures
    // as the Ethereum-standard `r(32) || s(32) || v(1)`; noble's `recoverPublicKey`
    // helper instead expects its own "recovered" layout with the recovery byte first,
    // so parse the standard layout explicitly. Wallets set v = 27/28 and dp1-go sets
    // 0/1; ids 2/3 stay in range since noble and go-ethereum both accept them.
    const recovery = sigBytes[64] >= 27 ? sigBytes[64] - 27 : sigBytes[64];
    const sig = secp256k1.Signature.fromBytes(sigBytes.subarray(0, 64), 'compact').addRecoveryBit(
      recovery
    );
    const recoveredPub = sig.recoverPublicKey(msg).toBytes(false);
    const recovered = `0x${bytesToHex(keccak_256(recoveredPub.subarray(1)).subarray(-20))}`;
    if (recovered.toLowerCase() !== addr.toLowerCase()) throw ErrSigInvalid;
  }
}

RegisterVerifier(new Ed25519Verifier());
RegisterVerifier(new Eip191Verifier());

export function NewEd25519Signer(privateKey: PrivateKeyLike) {
  const key = ed25519SecretKeyBytes(privateKey);
  return {
    alg: () => AlgEd25519,
    sign: (digest: Uint8Array): [string, Uint8Array] => [
      Ed25519DIDKey(ed25519.getPublicKey(key)),
      ed25519.sign(digest, key),
    ],
  };
}

export function NewEthereumSigner(privateKey: Uint8Array | string, chainID: number) {
  return {
    alg: () => AlgEIP191,
    sign: (digest: Uint8Array): [string, Uint8Array] => {
      const msg = keccak_256(concatBytes(EIP191_PREFIX, digest));
      const recoveredFormat = secp256k1.sign(
        msg,
        privateKey as Parameters<typeof secp256k1.sign>[1],
        { format: 'recovered', prehash: false }
      );
      // noble packs `recovery || r || s`. Re-pack into the Ethereum-standard wire
      // format `r || s || v` (v = recovery id + 27) so signatures are interoperable
      // with wallets (MetaMask personal_sign / eth_sign) and dp1-go.
      const sig = new Uint8Array(65);
      sig.set(recoveredFormat.subarray(1), 0);
      sig[64] = recoveredFormat[0] + 27;
      const pub = secp256k1.getPublicKey(
        privateKey as Parameters<typeof secp256k1.getPublicKey>[0],
        false
      );
      const addr = `0x${bytesToHex(keccak_256(pub.subarray(1)).subarray(-20))}`;
      return [EthereumAddressToDIDPKH(addr, chainID), sig];
    },
  };
}

export async function SignMultiEd25519(
  raw: BinaryLike,
  privateKey: PrivateKeyLike,
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
  raw: BinaryLike,
  privateKey: Uint8Array | string,
  chainID: number,
  role: string,
  ts: string
) {
  return SignMulti(raw, NewEthereumSigner(privateKey, chainID), role, ts);
}

export function SignLegacyEd25519(raw: BinaryLike, privateKey: PrivateKeyLike) {
  const key = ed25519SecretKeyBytes(privateKey);
  return `ed25519:${bytesToHex(ed25519.sign(signingDigest(raw), key))}`;
}

export function VerifyLegacyEd25519(raw: BinaryLike, legacySig: string, pub: PublicKeyLike) {
  if (!legacySig) throw new Error(`${ErrSigInvalid.message}: empty legacy signature`);
  if (!legacySig.startsWith('ed25519:'))
    throw new Error(`${ErrSigInvalid.message}: expected prefix "ed25519:"`);
  const bytes = decodeHexSignature(legacySig.slice(8));
  if (bytes.length !== 64)
    throw new Error(`${ErrSigInvalid.message}: bad signature length ${bytes.length}`);
  if (!verifyEd25519Digest(signingDigest(raw), bytes, pub)) throw ErrSigInvalid;
}

export function VerifyMultiSignature(
  raw: BinaryLike,
  sig: SignatureLike,
  publicKey?: PublicKeyLike
) {
  verifyPayloadHash(raw, sig.payload_hash);
  const digest = signingDigest(raw);
  const verifier = GetVerifier(sig.alg);
  const sigBytes = base64ToBytes(sig.sig);
  if (sig.alg === AlgEd25519 && publicKey) {
    if (!verifyEd25519Digest(digest, sigBytes, publicKey)) throw ErrSigInvalid;
    return true;
  }
  return verifier.verifySignature(sig.kid, sigBytes, digest);
}

export function VerifyMultiEd25519(raw: BinaryLike, sig: SignatureLike) {
  if (String(sig.alg).toLowerCase() !== AlgEd25519)
    throw new CodedError(ErrUnsupportedAlg.message, `"${sig.alg}"`);
  return VerifyMultiSignature(raw, sig);
}

function decodeBase58btc(input: string) {
  if (!input) return new Uint8Array(0);

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

  return Uint8Array.from([...new Array(leadingZeros).fill(0), ...bytes]);
}

function encodeBase58btc(bytes: Uint8Array) {
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

export function VerifyMultiSignaturesJSON(raw: BinaryLike) {
  const envelope = JSON.parse(toText(raw));
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

export function VerifyPlaylistSignatures(raw: BinaryLike) {
  return VerifyMultiSignaturesJSON(raw);
}
/**
 * @deprecated The DP-1 spec removed the Playlist-Group (Exhibition) object
 * (display-protocol/dp1#41): channels superseded it before it saw production use, and
 * zero groups were ever published. Use the channels extension instead
 * (`ChannelBuilder`, `ValidateChannel`, `VerifyChannelSignatures`). Retained for
 * backward compatibility and dp1-go parity; scheduled for removal in the next major.
 */
export function VerifyPlaylistGroupSignatures(raw: BinaryLike) {
  return VerifyMultiSignaturesJSON(raw);
}
export function VerifyChannelSignatures(raw: BinaryLike) {
  return VerifyMultiSignaturesJSON(raw);
}

export const signDP1Playlist = SignLegacyEd25519;
export const verifyPlaylistSignature = VerifyLegacyEd25519;

export async function verifyPlaylist(playlist: Record<string, unknown>, publicKey: PublicKeyLike) {
  if (!playlist || typeof playlist !== 'object') {
    throw new Error('playlist must be an object');
  }

  if (Array.isArray((playlist as { signatures?: unknown[] }).signatures)) {
    const verifyFn = VerifyPlaylistSignatures;
    const [ok] = verifyFn(JSON.stringify(playlist));
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
  VerifyLegacyEd25519(JSON.stringify(rawPlaylist), legacySig, publicKey);
  return true;
}
