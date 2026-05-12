import { test } from 'vitest';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { SignLegacyEd25519, VerifyLegacyEd25519 } from '../../src/sign/index.js';

test('LegacySignVerifyRoundTrip', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(
    '{"dpVersion":"1.0.0","title":"Test","items":[{"source":"https://example.com/a.html"}]}'
  );
  const legacy = SignLegacyEd25519(raw, privateKey);
  assert.doesNotThrow(() => VerifyLegacyEd25519(raw, legacy, publicKey));
});

test('VerifyLegacyEd25519_errors', () => {
  const { publicKey } = generateKeyPairSync('ed25519');
  assert.throws(() => VerifyLegacyEd25519(Buffer.from('{}'), '', publicKey));
  assert.throws(() => VerifyLegacyEd25519(Buffer.from('{}'), 'wrong:ab', publicKey));
  assert.throws(() => VerifyLegacyEd25519(Buffer.from('{}'), 'ed25519:zz', publicKey));
});

test('VerifyLegacyEd25519_wrongSigLen', () => {
  const { publicKey } = generateKeyPairSync('ed25519');
  assert.throws(() =>
    VerifyLegacyEd25519(
      Buffer.from('{"dpVersion":"1.0.0","title":"x","items":[{"source":"https://a"}]}'),
      'ed25519:' + 'ab'.repeat(20),
      publicKey
    )
  );
});
