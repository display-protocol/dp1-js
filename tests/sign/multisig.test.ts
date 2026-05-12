import { test } from 'vitest';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  SignMultiEd25519,
  VerifyMultiEd25519,
  VerifyMultiSignaturesJSON,
  VerifyPlaylistSignatures,
  VerifyPlaylistGroupSignatures,
  VerifyChannelSignatures,
} from '../../src/sign/index.js';
import { ErrUnsupportedAlg, ErrNoSignatures } from '../../src/errors.js';

test('MultiSigRoundTrip', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Multi","items":[{"source":"https://example.com"}]}'
  );
  const sig = await SignMultiEd25519(raw, privateKey, 'curator', '2025-01-01T00:00:00Z');
  assert.doesNotThrow(() => VerifyMultiEd25519(raw, sig));
});

test('VerifyMultiEd25519_unsupportedAlg', () => {
  assert.throws(
    () =>
      VerifyMultiEd25519(
        Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}'),
        {
          alg: 'eip191',
          kid: 'did:key:z',
          payload_hash: 'sha256:' + 'a'.repeat(64),
          sig: 'abc',
        }
      ),
    err => err instanceof Error && err.message.startsWith(ErrUnsupportedAlg.message)
  );
});

test('VerifyMultiEd25519_kidNotDidKey', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  const sig = await SignMultiEd25519(raw, privateKey, 'feed', '2025-01-01T00:00:00Z');
  assert.throws(() => VerifyMultiEd25519(raw, { ...sig, kid: 'did:web:example.com#key1' }));
});

test('VerifyMultiEd25519_wrongSigBytes', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  const sig = await SignMultiEd25519(raw, privateKey, 'feed', '2025-01-01T00:00:00Z');
  sig.sig = Buffer.from(new Uint8Array(64)).toString('base64url');
  assert.throws(() => VerifyMultiEd25519(raw, sig));
});

test('SignMultiEd25519_rejectsMismatchedKidOverride', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  await assert.rejects(
    () => SignMultiEd25519(raw, privateKey, 'feed', '2025-01-01T00:00:00Z', 'did:key:z123'),
    err => err instanceof Error && err.message.includes('kid override must match')
  );
});

test('VerifyMultiSignaturesJSON_wrappersMatch', () => {
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}],"signatures":[{"alg":"ed25519","kid":"did:key:z","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:' +
      'a'.repeat(64) +
      '","role":"feed","sig":"abc"}]}'
  );
  const a = VerifyMultiSignaturesJSON(raw);
  const b = VerifyPlaylistSignatures(raw);
  const c = VerifyPlaylistGroupSignatures(raw);
  const d = VerifyChannelSignatures(raw);
  assert.equal(Boolean(a[0]), Boolean(b[0]));
  assert.equal(Boolean(a[0]), Boolean(c[0]));
  assert.equal(Boolean(a[0]), Boolean(d[0]));
});

test('VerifyPlaylistSignatures_empty', () => {
  assert.throws(
    () => VerifyPlaylistSignatures(Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[]}')),
    ErrNoSignatures
  );
  assert.throws(() => VerifyPlaylistSignatures(Buffer.from('{"signatures":[]}')), ErrNoSignatures);
});

test('VerifyPlaylistSignatures_invalidJSON', () => {
  assert.throws(() => VerifyPlaylistSignatures(Buffer.from('{')));
});

test('VerifyPlaylistSignatures_allValid', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  const sig = await SignMultiEd25519(raw, privateKey, 'curator', '2025-01-01T00:00:00Z');
  const doc = Buffer.from(
    JSON.stringify({ ...JSON.parse(raw.toString('utf8')), signatures: [sig] })
  );
  const [ok, failed] = VerifyPlaylistSignatures(doc);
  assert.equal(ok, true);
  assert.equal(failed, null);
});

test('VerifyPlaylistSignatures_unsupportedAlg', () => {
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}],"signatures":[{"alg":"eip191","kid":"did:key:z","ts":"2025-01-01T00:00:00Z","payload_hash":"sha256:' +
      'a'.repeat(64) +
      '","role":"feed","sig":"abc"}]}'
  );
  const [ok, failed] = VerifyPlaylistSignatures(raw);
  assert.equal(ok, false);
  assert.equal(Array.isArray(failed), true);
});

test('VerifyPlaylistSignatures_firstOkSecondBad', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  const sig = await SignMultiEd25519(raw, privateKey, 'curator', '2025-01-01T00:00:00Z');
  const bad = { ...sig, sig: Buffer.from(new Uint8Array(64)).toString('base64url') };
  const doc = Buffer.from(
    JSON.stringify({ ...JSON.parse(raw.toString('utf8')), signatures: [sig, bad] })
  );
  const [ok, failed] = VerifyPlaylistSignatures(doc);
  assert.equal(ok, false);
  assert.equal(failed?.length, 1);
});

test('VerifyMultiWrongHash', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from('{"dpVersion":"1.1.0","title":"x","items":[{"source":"https://a"}]}');
  const sig = await SignMultiEd25519(raw, privateKey, 'feed', '2025-01-01T00:00:00Z');
  sig.payload_hash = 'sha256:' + '00' + sig.payload_hash.slice(9);
  assert.throws(() => VerifyMultiEd25519(raw, sig));
});
