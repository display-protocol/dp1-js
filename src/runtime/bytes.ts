/**
 * Byte helpers that work on Node, browsers, and Cloudflare Workers alike.
 *
 * The library used to lean on Node's `Buffer` for every byte operation, which forced the
 * `Buffer` global to exist: browsers have none, and Workers only have one under
 * `nodejs_compat`. Everything here is built from `Uint8Array`, `TextEncoder`/`TextDecoder`,
 * and `atob`/`btoa` — all three are standard on every target.
 *
 * `Bytes` keeps the one piece of `Buffer` ergonomics the public API exposed: byte outputs
 * such as `JcsTransform`'s answer to `.toString('utf8')`. A `Buffer` passed *in* still works
 * everywhere, because `Buffer` is a `Uint8Array` subclass.
 */
import { concatBytes, utf8ToBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export { concatBytes, utf8ToBytes, bytesToHex, hexToBytes };

/** Anything the library accepts where it used to say `Buffer | string`. */
export type BinaryLike = Uint8Array | string;

const decoder = new TextDecoder();

/** Encodings `Bytes.toString` understands, matching the `Buffer` names for each. */
export type BytesEncoding =
  | 'utf8'
  | 'utf-8'
  | 'hex'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'ascii';

/**
 * A `Uint8Array` that still answers `.toString(encoding)` the way `Buffer` does.
 *
 * Returned wherever the library used to return a `Buffer`. It is a real `Uint8Array`, so it
 * works with `fs.write`, `crypto`, `Response`, structured clone, and anything else that takes
 * a typed array — but `Buffer.isBuffer()` on it is `false`. Wrap it in `Buffer.from(...)` if
 * a downstream API genuinely demands a `Buffer`.
 */
export class Bytes extends Uint8Array {
  /**
   * Nominal brand, emitting nothing at runtime.
   *
   * Without it `Bytes` is structurally identical to `Uint8Array` — an extra *optional*
   * parameter on `toString` does not make a type incompatible — so a plain `Uint8Array` would
   * satisfy a `Bytes` return type, and `.toString('hex')` on it would quietly answer
   * `"1,2,3"` instead of hex. The brand turns that into a compile error.
   */
  declare private readonly __dp1Bytes: undefined;

  /** Copy a byte source into `Bytes`. Typed to return the subclass, which it always did. */
  static override from(source: ArrayLike<number> | Iterable<number>): Bytes {
    return asBytes(Uint8Array.from(source as ArrayLike<number>));
  }

  toString(encoding: BytesEncoding = 'utf8'): string {
    switch (encoding) {
      case 'utf8':
      case 'utf-8':
        return decoder.decode(this);
      case 'hex':
        return bytesToHex(this);
      case 'base64':
        return bytesToBase64(this, false);
      case 'base64url':
        return bytesToBase64(this, true);
      case 'latin1':
      case 'binary':
        return binaryString(this);
      case 'ascii':
        // `Buffer`'s 'ascii' masks the high bit rather than replacing the byte.
        return binaryString(this.map(byte => byte & 0x7f));
      default:
        throw new TypeError(`dp1: unsupported encoding "${String(encoding)}"`);
    }
  }
}

/** View bytes as `Bytes`, sharing memory rather than copying. */
export function asBytes(input: Uint8Array): Bytes {
  return new Bytes(input.buffer as ArrayBuffer, input.byteOffset, input.byteLength);
}

/** UTF-8 encode a string, or pass typed-array input through untouched. */
export function toBytes(input: BinaryLike): Uint8Array {
  return typeof input === 'string' ? utf8ToBytes(input) : input;
}

/**
 * Decode UTF-8 bytes to a string. Strings pass through, so callers can accept the
 * `Uint8Array | string` unions the public API uses without branching at every site.
 */
export function toText(input: BinaryLike): string {
  return typeof input === 'string' ? input : decoder.decode(input);
}

/** True for any typed-array/DataView input, the runtime-agnostic `Buffer.isBuffer`. */
export function isBinary(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

// `btoa`/`atob` take and return "binary strings" — one character per byte. Both are standard
// on Node 16+, every modern browser, and workerd; only the chunking below is ours, to keep
// `String.fromCharCode(...spread)` from blowing the argument limit on large payloads.
const CHUNK = 0x8000;

function binaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array, urlSafe: boolean): string {
  const base64 = btoa(binaryString(bytes));
  return urlSafe ? base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : base64;
}

/** Decode base64 or base64url; padding is optional, as it is for `Buffer.from(s, 'base64')`. */
export function base64ToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Base64url-encode bytes, the form DP-1 uses for `signatures[].sig`. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes, true);
}

/** Compare two byte sequences for equality. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Locate a byte pattern, or -1. Used to pick fields out of DER key encodings. */
export function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
