import { test } from 'vitest';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as nodeSign, verify as nodeVerify } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  decodeHexSignature,
  ed25519PublicKeyBytes,
  ed25519SecretKeyBytes,
} from '../../src/sign/keys.js';
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

// The DER path is parsed structurally (a tag-length-value walk), not by scanning for a byte
// pattern. These pin that it accepts the encodings that exist in the wild and fails closed on
// everything else, rather than handing back 32 bytes of whatever followed a matching prefix.

test('PKCS#8 v2 with an attached public key still yields the seed', () => {
  // RFC 5958 allows version 1 plus a [1] publicKey field after privateKey. Node exports v1,
  // so this shape has to be built by hand — but other toolchains do emit it.
  const v2 = Buffer.concat([
    Buffer.from('3051', 'hex'), // SEQUENCE, 81 bytes
    Buffer.from('020101', 'hex'), // version = 1 (v2)
    Buffer.from('300506032b6570', 'hex'), // AlgorithmIdentifier { id-Ed25519 }
    Buffer.from('04220420', 'hex'), // privateKey OCTET STRING { OCTET STRING(32) }
    RAW_SECRET,
    Buffer.from('812100', 'hex'), // [1] publicKey BIT STRING(33), 0 unused bits
    RAW_PUBLIC,
  ]);
  assert.deepEqual(Buffer.from(ed25519SecretKeyBytes(v2)), RAW_SECRET);
});

test('a private DER is not accepted as a public key, or vice versa', () => {
  assert.throws(() => ed25519PublicKeyBytes(PKCS8_DER), /dp1: invalid ed25519 public key/);
  assert.throws(() => ed25519SecretKeyBytes(SPKI_DER), /dp1: invalid ed25519 private key/);
  assert.throws(() => ed25519PublicKeyBytes(PKCS8_PEM), /dp1: invalid ed25519 public key/);
  assert.throws(() => ed25519SecretKeyBytes(SPKI_PEM), /dp1: invalid ed25519 private key/);
});

test('a crafted DER carrying the key-field byte pattern is rejected, not mis-sliced', () => {
  // A prefix scan for `03 21 00` / `04 22 04 20` would match inside this blob and return 32
  // bytes of junk. Structural parsing rejects it.
  const crafted = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    Buffer.from('030300', 'hex'),
    Buffer.from('032100', 'hex'),
    Buffer.alloc(40, 0xab),
  ]);
  assert.throws(() => ed25519PublicKeyBytes(crafted), /dp1: invalid ed25519 public key/);
});

test('truncated and non-Ed25519 DER fail closed', () => {
  assert.throws(() => ed25519SecretKeyBytes(PKCS8_DER.subarray(0, 20)), /malformed DER/);
  assert.throws(() => ed25519PublicKeyBytes(SPKI_DER.subarray(0, 20)), /malformed DER/);
  // Right structure, wrong algorithm: an X25519 SPKI (OID 1.3.101.110).
  const x25519Spki = Buffer.concat([
    Buffer.from('302a300506032b656e032100', 'hex'),
    Buffer.alloc(32, 1),
  ]);
  assert.throws(() => ed25519PublicKeyBytes(x25519Spki), /expected Ed25519/);
  // A declared length that runs past the end of the input.
  assert.throws(() => ed25519PublicKeyBytes(Buffer.from('30ff0102', 'hex')), /malformed DER/);
});

test('a non-Ed25519 DER keypair from node:crypto is rejected', () => {
  const p256 = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  assert.throws(
    () => ed25519SecretKeyBytes(p256.privateKey.export({ format: 'der', type: 'pkcs8' })),
    /dp1: invalid ed25519 private key/
  );
  assert.throws(
    () => ed25519PublicKeyBytes(p256.publicKey.export({ format: 'der', type: 'spki' })),
    /dp1: invalid ed25519 public key/
  );
});

test('decodeHexSignature accepts hex forms and answers empty for the rest', () => {
  const hex = 'ab'.repeat(32);
  assert.equal(Buffer.from(decodeHexSignature(hex)).toString('hex'), hex);
  assert.equal(Buffer.from(decodeHexSignature(`0x${hex}`)).toString('hex'), hex);
  assert.equal(Buffer.from(decodeHexSignature(`0X${hex}`)).toString('hex'), hex);
  assert.equal(Buffer.from(decodeHexSignature(`  ${hex}  `)).toString('hex'), hex);
  // Callers length-check the result, so unusable input becomes an empty array, not a throw.
  for (const bad of ['', '0x', 'zz', 'abc', 'ab cd', '0xzz']) {
    assert.equal(decodeHexSignature(bad).length, 0, JSON.stringify(bad));
  }
});
