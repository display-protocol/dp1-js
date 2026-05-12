import { test } from 'vitest';
import assert from 'node:assert/strict';
import { PayloadHashString, VerifyPayloadHash } from '../../src/sign/index.js';

test('PayloadHashString_idempotent', () => {
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  const ph1 = PayloadHashString(raw);
  const ph2 = PayloadHashString(raw);
  assert.equal(ph1, ph2);
});

test('PayloadHashString_equivalentAfterStrip', () => {
  const a = Buffer.from(
    '{"title":"x","dpVersion":"1.1.0","signature":"ed25519:ab","items":[{"source":"https://z"}],"signatures":[]}'
  );
  const b = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://z"}]}');
  assert.equal(PayloadHashString(a), PayloadHashString(b));
});

test('PayloadHashString_invalidJSON', () => {
  assert.throws(() => PayloadHashString(Buffer.from('not-json')));
});

test('VerifyPayloadHash_ok', () => {
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  const want = PayloadHashString(raw);
  assert.doesNotThrow(() => VerifyPayloadHash(raw, want));
});

test('VerifyPayloadHash_mismatch', () => {
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  assert.throws(() => VerifyPayloadHash(raw, 'sha256:' + '0'.repeat(64)));
});

test('VerifyPayloadHash_wrongPrefixStillMismatch', () => {
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  const ph = PayloadHashString(raw);
  assert.throws(() => VerifyPayloadHash(raw, ph.slice(7)));
});

test('VerifyPayloadHash_invalidJSON', () => {
  assert.throws(() => VerifyPayloadHash(Buffer.from('not json'), 'sha256:' + '0'.repeat(64)));
});
