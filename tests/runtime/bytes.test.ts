import { test } from 'vitest';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  Bytes,
  asBytes,
  base64ToBytes,
  bytesEqual,
  bytesToBase64Url,
  isBinary,
  toBytes,
  toText,
} from '../../src/runtime/bytes.js';

// These helpers replace the `Buffer` global, which browsers lack entirely and Workers only
// have under `nodejs_compat`. Node's `Buffer` is the reference implementation here, so the
// encodings are checked against it directly.

const SAMPLES = [
  Uint8Array.of(),
  Uint8Array.of(0),
  Uint8Array.of(0, 1, 2, 253, 254, 255),
  new TextEncoder().encode('hello dp1'),
  new TextEncoder().encode('unicode: héllo — 🌍 ✓'),
  ...[1, 2, 3, 31, 32, 33, 64, 1000].map(n => new Uint8Array(randomBytes(n))),
];

test('Bytes.toString matches Buffer for every supported encoding', () => {
  for (const sample of SAMPLES) {
    const bytes = Bytes.from(sample);
    const buffer = Buffer.from(sample);
    for (const encoding of ['utf8', 'hex', 'base64', 'base64url', 'latin1', 'ascii'] as const) {
      assert.equal(bytes.toString(encoding), buffer.toString(encoding), `${encoding} of ${sample}`);
    }
    // `Buffer`'s default is utf8; so is ours.
    assert.equal(bytes.toString(), buffer.toString());
  }
});

test('Bytes.toString rejects an unknown encoding rather than guessing', () => {
  assert.throws(() => Bytes.from([1, 2, 3]).toString('utf16le' as never), TypeError);
});

test('Bytes is a real Uint8Array', () => {
  const bytes = Bytes.from([1, 2, 3]);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes.length, 3);
  // Interop the other way: a consumer that genuinely needs a Buffer can still wrap it.
  assert.ok(Buffer.from(bytes).equals(Buffer.from([1, 2, 3])));
});

test('asBytes views without copying', () => {
  const source = Uint8Array.of(1, 2, 3, 4);
  const view = asBytes(source.subarray(1, 3));
  assert.deepEqual([...view], [2, 3]);
  source[1] = 9;
  assert.equal(view[0], 9, 'asBytes should share memory, not copy');
});

test('base64 round-trips, tolerating url-safe and unpadded input', () => {
  for (const sample of SAMPLES) {
    const urlSafe = bytesToBase64Url(sample);
    assert.equal(urlSafe, Buffer.from(sample).toString('base64url'));
    assert.ok(bytesEqual(base64ToBytes(urlSafe), sample), 'base64url round-trip');
    assert.ok(bytesEqual(base64ToBytes(Buffer.from(sample).toString('base64')), sample));
  }
  // Padded, unpadded, and url-safe spellings all decode alike.
  assert.ok(bytesEqual(base64ToBytes('AQID'), Uint8Array.of(1, 2, 3)));
  assert.ok(bytesEqual(base64ToBytes('+/8='), base64ToBytes('-_8')));
});

test('base64 handles payloads larger than the fromCharCode chunk', () => {
  // 0x8000 is the chunk boundary in bytesToBase64; spanning it must not corrupt output.
  const big = new Uint8Array(randomBytes(0x8000 * 2 + 17));
  assert.equal(bytesToBase64Url(big), Buffer.from(big).toString('base64url'));
  assert.ok(bytesEqual(base64ToBytes(bytesToBase64Url(big)), big));
  assert.equal(Bytes.from(big).toString('hex'), Buffer.from(big).toString('hex'));
});

test('toBytes and toText round-trip strings and pass typed arrays through', () => {
  const text = 'canonical — ✓';
  assert.equal(toText(toBytes(text)), text);
  const bytes = Uint8Array.of(1, 2, 3);
  assert.equal(toBytes(bytes), bytes, 'typed arrays pass through untouched');
  assert.equal(toText('already a string'), 'already a string');
  assert.equal(toText(Buffer.from('from a Buffer')), 'from a Buffer');
});

test('isBinary recognizes Buffer and Uint8Array, and nothing else', () => {
  assert.equal(isBinary(Buffer.from('x')), true);
  assert.equal(isBinary(Uint8Array.of(1)), true);
  assert.equal(isBinary(Bytes.from([1])), true);
  for (const value of ['x', 1, null, undefined, {}, [], new ArrayBuffer(4)]) {
    assert.equal(isBinary(value), false, String(value));
  }
});
