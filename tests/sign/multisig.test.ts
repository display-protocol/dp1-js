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

// R7: trust policy and role enum

async function signedBy(role: string, ts = '2025-01-01T00:00:00Z') {
  const { privateKey } = generateKeyPairSync('ed25519');
  const body = { title: 'x' };
  const sig = await SignMultiEd25519(Buffer.from(JSON.stringify(body)), privateKey, role, ts);
  return { raw: Buffer.from(JSON.stringify({ ...body, signatures: [sig] })), sig };
}

test('VerifyMultiSignaturesJSON_withoutPolicyOnlyProvesIntegrity', async () => {
  const { raw } = await signedBy('agent');
  assert.equal(VerifyMultiSignaturesJSON(raw)[0], true);
});

test('VerifyMultiSignaturesJSON_requireRoles', async () => {
  const agent = await signedBy('agent');
  const [ok, failed, err] = VerifyMultiSignaturesJSON(agent.raw, {
    requireRoles: ['feed', 'curator'],
  });
  assert.equal(ok, false);
  assert.equal(failed, null);
  assert.match(String(err?.message), /required role/);
  const feed = await signedBy('feed');
  assert.equal(VerifyMultiSignaturesJSON(feed.raw, { requireRoles: ['feed', 'curator'] })[0], true);
});

test('VerifyMultiSignaturesJSON_trustedKids', async () => {
  const { raw, sig } = await signedBy('feed');
  assert.equal(VerifyMultiSignaturesJSON(raw, { trustedKids: [sig.kid] })[0], true);
  const [ok, failed] = VerifyMultiSignaturesJSON(raw, { trustedKids: ['did:key:other'] });
  assert.equal(ok, false);
  assert.equal(failed?.length, 1);
});

test('VerifyMultiSignaturesJSON_rejectsFutureTimestamps', async () => {
  const { raw } = await signedBy('feed', '2030-01-01T00:00:00Z');
  const now = new Date('2025-01-01T00:00:00Z');
  assert.equal(VerifyMultiSignaturesJSON(raw)[0], true);
  assert.equal(VerifyMultiSignaturesJSON(raw, { rejectFutureTimestamps: true, now })[0], false);
});

test('SignMulti_rejectsUnknownRoleAndAcceptsPublisher', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from('{"a":1}');
  await assert.rejects(
    async () => SignMultiEd25519(raw, privateKey, 'admin', '2025-01-01T00:00:00Z'),
    /not allowed for a playlist/
  );
  // `publisher` is a channel-only role: the playlist schema's role enum does not allow it
  await assert.rejects(
    async () => SignMultiEd25519(raw, privateKey, 'publisher', '2025-01-01T00:00:00Z'),
    /not allowed for a playlist/
  );
  assert.equal(
    (
      await SignMultiEd25519(
        raw,
        privateKey,
        'publisher',
        '2025-01-01T00:00:00Z',
        undefined,
        'channel'
      )
    ).role,
    'publisher'
  );
});
