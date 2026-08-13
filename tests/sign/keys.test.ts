import { test } from 'vitest';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as nodeSign, verify as nodeVerify } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { ed25519PublicKeyBytes, ed25519SecretKeyBytes } from '../../src/sign/keys.js';
import {
  SignLegacyEd25519,
  SignMultiEd25519,
  VerifyLegacyEd25519,
  VerifyMultiEd25519,
} from '../../src/sign/index.js';

// Signing moved from `node:crypto` to `@noble/curves`, which takes 32 raw bytes. The public
// API accepted whatever `createPrivateKey`/`createPublicKey` did — Node KeyObjects above all —
// so every one of those spellings must still reduce to the same key on every runtime.

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const RAW_SECRET = Buffer.from(privateKey.export({ format: 'jwk' }).d!, 'base64url');
const RAW_PUBLIC = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url');
const PKCS8_DER = privateKey.export({ format: 'der', type: 'pkcs8' });
const SPKI_DER = publicKey.export({ format: 'der', type: 'spki' });
const PKCS8_PEM = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
const SPKI_PEM = publicKey.export({ format: 'pem', type: 'spki' }) as string;

const RAW = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');

const PRIVATE_FORMS: Array<[string, unknown]> = [
  ['Node KeyObject', privateKey],
  ['raw 32 bytes', RAW_SECRET],
  ['raw 32 bytes as Uint8Array', Uint8Array.from(RAW_SECRET)],
  ['raw hex', RAW_SECRET.toString('hex')],
  ['raw hex with 0x prefix', `0x${RAW_SECRET.toString('hex')}`],
  ['PKCS#8 DER', PKCS8_DER],
  ['PKCS#8 DER as hex', PKCS8_DER.toString('hex')],
  ['PKCS#8 DER as base64', PKCS8_DER.toString('base64')],
  ['PKCS#8 PEM', PKCS8_PEM],
  ['{ key, format, type } wrapper', { key: PKCS8_DER, format: 'der', type: 'pkcs8' }],
];

const PUBLIC_FORMS: Array<[string, unknown]> = [
  ['Node KeyObject', publicKey],
  ['raw 32 bytes', RAW_PUBLIC],
  ['raw hex', RAW_PUBLIC.toString('hex')],
  ['SPKI DER', SPKI_DER],
  ['SPKI DER as base64', SPKI_DER.toString('base64')],
  ['SPKI PEM', SPKI_PEM],
  ['{ key, format, type } wrapper', { key: SPKI_DER, format: 'der', type: 'spki' }],
];

test('every accepted private-key form reduces to the same secret', () => {
  for (const [label, form] of PRIVATE_FORMS) {
    assert.deepEqual(
      Buffer.from(ed25519SecretKeyBytes(form as never)),
      RAW_SECRET,
      `private key from ${label}`
    );
  }
});

test('every accepted public-key form reduces to the same point', () => {
  for (const [label, form] of PUBLIC_FORMS) {
    assert.deepEqual(
      Buffer.from(ed25519PublicKeyBytes(form as never)),
      RAW_PUBLIC,
      `public key from ${label}`
    );
  }
});

test('a private KeyObject yields the secret, not the public point', () => {
  // The private JWK carries `x` alongside `d`; reading the wrong one would silently sign with
  // the public point as a scalar.
  assert.deepEqual(Buffer.from(ed25519SecretKeyBytes(privateKey)), RAW_SECRET);
  assert.notDeepEqual(Buffer.from(ed25519SecretKeyBytes(privateKey)), RAW_PUBLIC);
});

test('signatures are byte-identical to node:crypto, so dp1-go interop is unchanged', () => {
  const message = Buffer.from('dp1 canonical digest stand-in');
  assert.deepEqual(
    Buffer.from(ed25519.sign(message, RAW_SECRET)),
    nodeSign(null, message, privateKey)
  );
  assert.ok(nodeVerify(null, message, publicKey, ed25519.sign(message, RAW_SECRET)));
});

test('every private-key form produces the same signature through the public API', async () => {
  const expected = await SignMultiEd25519(RAW, privateKey, 'curator', '2025-01-01T00:00:00Z');
  for (const [label, form] of PRIVATE_FORMS) {
    const sig = await SignMultiEd25519(RAW, form as never, 'curator', '2025-01-01T00:00:00Z');
    assert.deepEqual(sig, expected, `SignMultiEd25519 with ${label}`);
    assert.doesNotThrow(() => VerifyMultiEd25519(RAW, sig), `verify with ${label}`);
  }
});

test('every public-key form verifies a legacy signature', () => {
  const legacy = SignLegacyEd25519(RAW, privateKey);
  for (const [label, form] of PUBLIC_FORMS) {
    assert.doesNotThrow(() => VerifyLegacyEd25519(RAW, legacy, form as never), label);
  }
});

test('unusable key inputs are rejected with an actionable message', () => {
  const cases: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['non-key text', 'not a key at all!'],
    ['wrong length', Buffer.alloc(31)],
    ['non-Ed25519 DER', Buffer.alloc(48)],
    ['number', 42],
    ['plain object', { nope: true }],
  ];
  for (const [label, value] of cases) {
    assert.throws(
      () => ed25519SecretKeyBytes(value as never),
      /dp1: invalid ed25519 private key/,
      label
    );
  }
});

test('a non-Ed25519 KeyObject is rejected rather than silently misread', () => {
  const p256 = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  assert.throws(() => ed25519SecretKeyBytes(p256.privateKey), /expected Ed25519/);
  assert.throws(() => ed25519PublicKeyBytes(p256.publicKey), /expected Ed25519/);
});
