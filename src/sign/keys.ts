/**
 * Ed25519 key normalization, without `node:crypto`.
 *
 * Signing and verification run on `@noble/curves`, which speaks one shape: 32 raw bytes. The
 * public API historically accepted whatever `crypto.createPrivateKey` / `createPublicKey`
 * accepted — Node `KeyObject`s above all, which `tests/sign/` passes throughout — so this
 * module reduces every one of those forms to raw bytes on any runtime:
 *
 * | Input                                   | How it is read                                  |
 * |-----------------------------------------|-------------------------------------------------|
 * | raw 32 bytes                            | used as-is (the natural `@noble` shape)          |
 * | DER (PKCS#8 private / SPKI public)      | the scalar is sliced out of the encoding         |
 * | PEM                                     | de-armoured to DER, then as above                |
 * | hex or base64 string                    | decoded to bytes, then as above                  |
 * | Node `KeyObject`                        | `key.export({ format: 'jwk' })` → `d` / `x`      |
 * | `{ key, format, type }`                 | unwrapped, then as above                         |
 *
 * The `KeyObject` path is the reason this works off-Node without giving anything up: `export`
 * is a method on the object the caller handed us, not an import. A browser or Worker simply
 * never has a `KeyObject` to pass.
 */
import { base64ToBytes, hexToBytes, toText } from '../runtime/bytes.js';

/** Every key form the signing API accepts. */
export type Ed25519KeyLike =
  | Uint8Array
  | string
  | { export?: unknown; key?: unknown; type?: unknown; format?: unknown }
  | null
  | undefined;

const ED25519_KEY_BYTES = 32;

// 1.3.101.112 (id-Ed25519), the OID body shared by the PKCS#8 and SPKI encodings.
const ED25519_OID = Uint8Array.of(0x2b, 0x65, 0x70);

// DER tags used by the two Ed25519 key encodings.
const TAG_INTEGER = 0x02;
const TAG_BIT_STRING = 0x03;
const TAG_OCTET_STRING = 0x04;
const TAG_OID = 0x06;
const TAG_SEQUENCE = 0x30;

type Jwk = { kty?: string; crv?: string; d?: string; x?: string };

/** Reduce any accepted private-key form to the 32-byte Ed25519 seed. */
export function ed25519SecretKeyBytes(key: Ed25519KeyLike): Uint8Array {
  return normalize(key, 'private');
}

/** Reduce any accepted public-key form to the 32-byte Ed25519 point. */
export function ed25519PublicKeyBytes(key: Ed25519KeyLike): Uint8Array {
  return normalize(key, 'public');
}

function normalize(key: Ed25519KeyLike, kind: 'private' | 'public'): Uint8Array {
  if (key === null || key === undefined) throw keyError(kind, 'missing key');

  if (key instanceof Uint8Array) return fromEncodedBytes(key, kind);
  if (typeof key === 'string') return fromString(key, kind);

  if (typeof key === 'object') {
    // A Node KeyObject. JWK is the only export format that hands back the raw scalar
    // directly, and it is defined for Ed25519 as `{ kty: 'OKP', crv: 'Ed25519', d, x }`.
    if (typeof (key as { export?: unknown }).export === 'function') {
      return fromKeyObject(key as { export: (options: { format: 'jwk' }) => unknown }, kind);
    }
    // A `{ key, format, type }` wrapper, as `createPrivateKey` accepts.
    if ('key' in key && key.key !== undefined && key.key !== key) {
      return normalize(key.key as Ed25519KeyLike, kind);
    }
  }

  throw keyError(kind, `unsupported key type ${describe(key)}`);
}

function fromKeyObject(
  key: { export: (options: { format: 'jwk' }) => unknown },
  kind: 'private' | 'public'
): Uint8Array {
  let jwk: Jwk;
  try {
    jwk = key.export({ format: 'jwk' }) as Jwk;
  } catch (err) {
    throw keyError(kind, `key.export({ format: 'jwk' }) failed: ${messageOf(err)}`);
  }
  if (jwk?.crv && jwk.crv !== 'Ed25519') throw keyError(kind, `expected Ed25519, got ${jwk.crv}`);
  // A private JWK carries `x` too; read `d` first so a private KeyObject stays private.
  const encoded = kind === 'private' ? jwk?.d : jwk?.x;
  if (typeof encoded !== 'string')
    throw keyError(kind, `JWK export has no "${kind === 'private' ? 'd' : 'x'}" parameter`);
  return exact(base64ToBytes(encoded), kind);
}

function fromString(value: string, kind: 'private' | 'public'): Uint8Array {
  const trimmed = value.trim();
  if (!trimmed) throw keyError(kind, 'empty key string');

  if (trimmed.includes('-----BEGIN')) return fromEncodedBytes(pemToDer(trimmed, kind), kind);

  // Hex first: a 64-character raw key is valid base64 too, and hex is the intended reading.
  const hex = trimmed.replace(/^0x/, '');
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
    return fromEncodedBytes(hexToBytes(hex), kind);
  }
  if (/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) return fromEncodedBytes(base64ToBytes(trimmed), kind);

  throw keyError(kind, 'invalid key encoding (expected raw hex, base64, or PEM)');
}

function pemToDer(pem: string, kind: 'private' | 'public'): Uint8Array {
  const match = /-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/.exec(pem);
  if (!match) throw keyError(kind, 'malformed PEM');
  return base64ToBytes(match[1].replace(/\s+/g, ''));
}

/** Raw 32 bytes, or a DER encoding the key is parsed out of. */
function fromEncodedBytes(bytes: Uint8Array, kind: 'private' | 'public'): Uint8Array {
  if (bytes.length === ED25519_KEY_BYTES) return bytes;
  return kind === 'private' ? parsePkcs8(bytes) : parseSpki(bytes);
}

/**
 * Minimal DER reader: one tag-length-value element at a time.
 *
 * Walking the structure rather than searching for a byte pattern matters here. A scan for the
 * `04 22 04 20` / `03 21 00` prefix would happily match those bytes anywhere — inside an
 * unrelated field, or in a crafted blob — and hand back 32 bytes of whatever followed. Since
 * this parser feeds signature verification, an unparseable input must fail, never yield
 * plausible-looking garbage.
 */
class DerReader {
  private offset = 0;

  constructor(
    private readonly bytes: Uint8Array,
    private readonly kind: 'private' | 'public'
  ) {}

  /** Read one element of the expected tag and return its contents. */
  read(expectedTag: number): Uint8Array {
    const tag = this.byte();
    if (tag !== expectedTag) {
      throw keyError(
        this.kind,
        `malformed DER: expected tag 0x${expectedTag.toString(16)}, got 0x${tag.toString(16)}`
      );
    }

    let length = this.byte();
    if (length & 0x80) {
      // Long form: the low bits give the number of subsequent length bytes.
      const count = length & 0x7f;
      if (count === 0 || count > 4) throw keyError(this.kind, 'malformed DER: bad length');
      length = 0;
      for (let i = 0; i < count; i++) length = length * 256 + this.byte();
    }

    const end = this.offset + length;
    if (end > this.bytes.length) throw keyError(this.kind, 'malformed DER: length overruns input');
    const value = this.bytes.subarray(this.offset, end);
    this.offset = end;
    return value;
  }

  private byte(): number {
    if (this.offset >= this.bytes.length)
      throw keyError(this.kind, 'malformed DER: unexpected end of input');
    return this.bytes[this.offset++];
  }
}

/** Confirm an AlgorithmIdentifier names id-Ed25519, so a P-256 key cannot be misread. */
function expectEd25519Algorithm(algorithm: Uint8Array, kind: 'private' | 'public') {
  const oid = new DerReader(algorithm, kind).read(TAG_OID);
  if (!bytesStartWith(oid, ED25519_OID) || oid.length !== ED25519_OID.length) {
    throw keyError(kind, 'expected Ed25519, got a different key algorithm');
  }
}

/** PrivateKeyInfo (RFC 5208 / RFC 8410 §7): version, algorithm, privateKey OCTET STRING. */
function parsePkcs8(bytes: Uint8Array): Uint8Array {
  const outer = new DerReader(bytes, 'private');
  const body = new DerReader(outer.read(TAG_SEQUENCE), 'private');
  body.read(TAG_INTEGER); // version
  expectEd25519Algorithm(body.read(TAG_SEQUENCE), 'private');
  // The privateKey field wraps a CurvePrivateKey, itself an OCTET STRING of the 32-byte seed.
  const wrapped = body.read(TAG_OCTET_STRING);
  const seed = new DerReader(wrapped, 'private').read(TAG_OCTET_STRING);
  // Trailing attributes / publicKey (PKCS#8 v2) are legal and simply ignored.
  return exact(seed, 'private');
}

/** SubjectPublicKeyInfo (RFC 5280 / RFC 8410 §4): algorithm, subjectPublicKey BIT STRING. */
function parseSpki(bytes: Uint8Array): Uint8Array {
  const outer = new DerReader(bytes, 'public');
  const body = new DerReader(outer.read(TAG_SEQUENCE), 'public');
  expectEd25519Algorithm(body.read(TAG_SEQUENCE), 'public');
  const bitString = body.read(TAG_BIT_STRING);
  if (bitString.length === 0 || bitString[0] !== 0x00) {
    throw keyError('public', 'malformed DER: BIT STRING must have zero unused bits');
  }
  return exact(bitString.subarray(1), 'public');
}

function bytesStartWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (bytes[i] !== prefix[i]) return false;
  return true;
}

function exact(bytes: Uint8Array, kind: 'private' | 'public'): Uint8Array {
  if (bytes.length !== ED25519_KEY_BYTES)
    throw keyError(kind, `key must be ${ED25519_KEY_BYTES} bytes, got ${bytes.length}`);
  return bytes;
}

function describe(key: unknown): string {
  if (key === null) return 'null';
  if (Array.isArray(key)) return 'array';
  return typeof key === 'object' ? `object without "export" or "key"` : typeof key;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function keyError(kind: 'private' | 'public', detail: string): Error {
  return new Error(`dp1: invalid ed25519 ${kind} key: ${detail}`);
}

/** Read a legacy signature that may be hex, with or without a `0x` prefix. */
export function decodeHexSignature(encoded: string): Uint8Array {
  const trimmed = toText(encoded).trim();
  const hex = /^0x/i.test(trimmed) ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) return new Uint8Array(0);
  return hexToBytes(hex);
}
