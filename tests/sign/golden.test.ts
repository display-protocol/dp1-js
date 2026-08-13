import { test } from 'vitest';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as nodeSign, verify as nodeVerify } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  Ed25519DIDKey,
  PayloadHashString,
  SignLegacyEd25519,
  SignMultiEd25519,
  VerifyLegacyEd25519,
  VerifyMultiEd25519,
} from '../../src/sign/index.js';

// Frozen interop vector.
//
// Signing moved from `node:crypto` to `@noble/curves`; `tests/sign/keys.test.ts` cross-checks
// the two in-process, which is the stronger check *today* but evaporates the moment
// `node:crypto` is not in the test environment — a browser or Workers test run, say. These
// literals pin the whole chain (JCS → digest → payload_hash → signature → did:key) to values
// produced before the migration, so a change to canonicalization and a change to signing
// cannot cancel out unnoticed. dp1-go must agree with these too.
//
// Regenerate ONLY if the DP-1 spec changes the canonical form, and say so in the CHANGELOG.
const SEED = Buffer.from('4a6f8b2c1d3e5f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8', 'hex');
const PUBLIC_HEX = '16bafab53e91aad7eabc099d17f5e50c989100d3d395565c1268ae36cb6f0592';
const RAW =
  '{"dpVersion":"1.1.0","title":"golden","items":[{"source":"https://example.com/a.html"}]}';

const GOLDEN = {
  didKey: 'did:key:z6MkfyzP1ZwTacYAwsLxjcXVZ4NcXEycf3XkkKNYDJrTaaKs',
  payloadHash: 'sha256:28b6ec7a7632cdde7c0f8030f9527b74b460c4f4a75fd711f114a1d82c95bdb1',
  sig: 'Y-ivtq8jyTQcXP6HUwaZF98bJ_VD7oFpKjDld6xpjEXu1uHa5ZXZPfqa1Mq3ZR-ydf0w-_j0z48BYlJIiscKCQ',
  legacy:
    'ed25519:63e8afb6af23c9341c5cfe8753069917df1b27f543ee81692a30e577ac698c45eed6e1dae595d93dfa9ad4cab7651fb275fd30fbf8f4cf8f016252488ac70a09',
} as const;

test('the seed derives the pinned public key and did:key', () => {
  const pub = ed25519.getPublicKey(SEED);
  assert.equal(Buffer.from(pub).toString('hex'), PUBLIC_HEX);
  assert.equal(Ed25519DIDKey(pub), GOLDEN.didKey);
});

test('canonicalization and digest still produce the pinned payload_hash', () => {
  assert.equal(PayloadHashString(RAW), GOLDEN.payloadHash);
  // Byte input and string input must canonicalize identically.
  assert.equal(PayloadHashString(Buffer.from(RAW)), GOLDEN.payloadHash);
});

test('SignMultiEd25519 still produces the pinned signature', async () => {
  const sig = await SignMultiEd25519(RAW, SEED, 'curator', '2025-01-01T00:00:00Z');
  assert.deepEqual(sig, {
    alg: 'ed25519',
    kid: GOLDEN.didKey,
    ts: '2025-01-01T00:00:00Z',
    payload_hash: GOLDEN.payloadHash,
    role: 'curator',
    sig: GOLDEN.sig,
  });
  assert.doesNotThrow(() => VerifyMultiEd25519(RAW, sig));
});

test('SignLegacyEd25519 still produces the pinned legacy signature', () => {
  assert.equal(SignLegacyEd25519(RAW, SEED), GOLDEN.legacy);
  assert.doesNotThrow(() =>
    VerifyLegacyEd25519(RAW, GOLDEN.legacy, Buffer.from(PUBLIC_HEX, 'hex'))
  );
});

test('the pinned signature is what node:crypto produces for the same digest', () => {
  // Belt and braces while `node:crypto` is available: prove the frozen literals are not just
  // self-consistent with @noble, but the same bytes OpenSSL emits.
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), SEED]);
  const spki = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    Buffer.from(PUBLIC_HEX, 'hex'),
  ]);
  const privateDer = { key: pkcs8, format: 'der' as const, type: 'pkcs8' as const };
  const publicDer = { key: spki, format: 'der' as const, type: 'spki' as const };
  const digest = Buffer.from(GOLDEN.payloadHash.slice('sha256:'.length), 'hex');
  assert.equal(
    nodeSign(null, digest, privateDer).toString('base64url'),
    GOLDEN.sig,
    'node:crypto disagrees with the frozen signature'
  );
  assert.ok(nodeVerify(null, digest, publicDer, Buffer.from(GOLDEN.sig, 'base64url')));
});

test('a freshly generated key still round-trips through both stacks', async () => {
  // Guards the general case the frozen vector cannot: any key, not just the pinned one.
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const sig = await SignMultiEd25519(RAW, privateKey, 'feed', '2025-01-01T00:00:00Z');
  const digest = Buffer.from(PayloadHashString(RAW).slice('sha256:'.length), 'hex');
  assert.ok(
    nodeVerify(null, digest, publicKey, Buffer.from(sig.sig, 'base64url')),
    'node:crypto could not verify a dp1-js signature'
  );
});
