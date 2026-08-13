import { asBytes, toText, utf8ToBytes, type BinaryLike, type Bytes } from '../runtime/bytes.js';

function escapeString(value: string) {
  return JSON.stringify(value);
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return escapeString(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('dp1: non-finite number in JSON');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map(key => `${escapeString(key)}:${canonicalize(obj[key])}`)
      .join(',')}}`;
  }
  throw new Error(`dp1: unsupported JSON value type: ${typeof value}`);
}

/**
 * Canonicalize a JSON document (RFC 8785 JCS) and return the UTF-8 bytes.
 *
 * Returns `Bytes`, a `Uint8Array` that still answers `.toString('utf8')` the way the
 * `Buffer` this used to return did.
 */
export function transform(input: BinaryLike): Bytes {
  return asBytes(utf8ToBytes(canonicalize(JSON.parse(toText(input)))));
}
