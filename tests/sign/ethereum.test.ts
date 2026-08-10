import { test } from 'vitest';
import assert from 'node:assert/strict';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import {
  SignMultiEIP191,
  VerifyMultiSignature,
  EthereumAddressFromDIDPKH,
} from '../../src/sign/index.js';

test('EthereumSignerVerifierRoundTrip', async () => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Ethereum Test","items":[{"source":"https://example.com/art.html"}]}'
  );
  const sig = await SignMultiEIP191(raw, secretKey, 1, 'curator', '2026-04-13T10:00:00Z');
  assert.doesNotThrow(() => VerifyMultiSignature(raw, sig));
});

test('EthereumVerifierInvalidSignature', async () => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Test","items":[{"source":"https://example.com"}]}'
  );
  const sig = await SignMultiEIP191(raw, secretKey, 1, 'feed', '2026-04-13T10:00:00Z');
  sig.sig = sig.sig.slice(1) + sig.sig[0];
  assert.throws(() => VerifyMultiSignature(raw, sig));
});

test('EthereumVerifierWrongDocument', async () => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw1 = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Original","items":[{"source":"https://example.com/1"}]}'
  );
  const sig = await SignMultiEIP191(raw1, secretKey, 1, 'curator', '2026-04-13T10:00:00Z');
  const raw2 = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Different","items":[{"source":"https://example.com/2"}]}'
  );
  assert.throws(() => VerifyMultiSignature(raw2, sig));
});

test('EthereumVerifierMultipleChains', async () => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Multi-chain","items":[{"source":"https://example.com"}]}'
  );
  for (const chainID of [1, 137, 42161, 8453]) {
    const sig = await SignMultiEIP191(raw, secretKey, chainID, 'feed', '2026-04-13T10:00:00Z');
    const [addr, gotChain] = EthereumAddressFromDIDPKH(sig.kid);
    assert.ok(addr.startsWith('0x'));
    assert.equal(gotChain, chainID);
    assert.doesNotThrow(() => VerifyMultiSignature(raw, sig));
  }
});

// Wallets (MetaMask personal_sign, eth_sign, ethers/viem signMessage) encode the
// ECDSA recovery id as v = 27/28, not the raw 0/1 that noble's recoverPublicKey
// expects. This is a real document signed by a wallet through the publisher's
// `#/sign` path (see display-protocol/dp1-js#<issue>), captured to guard against
// regressing that normalization.
test('EthereumVerifierAcceptsWalletRecoveryId', () => {
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","id":"c9b5144c-ef12-4112-8eff-cded4bee2c74","title":"Publisher smoke 2026-07-30","slug":"publisher-smoke-2026-07-30-c9b5144c","created":"2026-07-30T12:43:04.677Z","items":[{"id":"089ff812-9b69-4f44-a051-c95acdc03407","title":"Test card","source":"https://dp1.feralfile.com/","duration":300,"license":"open"}],"signatures":[{"alg":"eip191","kid":"did:pkh:eip155:1:0x9E4e4c30B92D4109442215027279Fdaed45a620f","ts":"2026-07-30T12:43:36.266Z","payload_hash":"sha256:7a522c0fdb215e88dec78961d9d081b1a42a8b4b89bed818c8b3539f7452f915","role":"curator","sig":"NrKqFzthcOJTk9LXKMCZrLsCA3DPA7f5gi5Hl2zBw7scsRIA1l64CNflgeFhDvBr9wotkAm4S42jNFBgTrcRGhw"},{"alg":"ed25519","kid":"did:key:z6MkiCBAPqLbkzZmLG2nAyfzJqfiEr58NDscj2ar4FJ1pP3U","ts":"2026-07-30T12:43:04Z","payload_hash":"sha256:7a522c0fdb215e88dec78961d9d081b1a42a8b4b89bed818c8b3539f7452f915","role":"feed","sig":"qsZogEdAKnahcUDErEKZTfSp5_zKoDTijvA67Qhcd_v_zzW9pEX-ZtBV5KMVoi2FqcmWfm-7wjIV32RxBep1Cg"}],"curators":[{"name":"","key":"did:pkh:eip155:1:0x9E4e4c30B92D4109442215027279Fdaed45a620f"}],"summary":"Post-deploy check of the review-and-sign page. Safe to ignore."}'
  );
  const playlist = JSON.parse(raw.toString());
  const eip191Sig = playlist.signatures.find((s: { alg: string }) => s.alg === 'eip191');
  const sigBytes = Buffer.from(eip191Sig.sig, 'base64url');
  assert.equal(sigBytes[64], 28, 'fixture must carry a wallet-style v=27/28 recovery id');
  assert.doesNotThrow(() => VerifyMultiSignature(raw, eip191Sig));
});
