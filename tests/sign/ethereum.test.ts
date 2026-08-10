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
// ECDSA recovery id as v = 27/28 in an `r || s || v` layout, not the recovery-first
// `recovery || r || s` that noble's recoverPublicKey helper expects. This is a real
// document signed by a wallet through the publisher's `#/sign` path (see
// feral-file/ff-cli#103), captured to guard against regressing that handling.
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

// dp1-go's EthereumSigner returns v as 0/1 rather than 27/28. Both must verify, so
// the `recovery < 27` branch (the go -> js interop direction) stays covered.
test('EthereumVerifierAcceptsRawRecoveryId', async () => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Raw recid","items":[{"source":"https://example.com"}]}'
  );
  const sig = await SignMultiEIP191(raw, secretKey, 1, 'curator', '2026-04-13T10:00:00Z');

  const bytes = Buffer.from(sig.sig, 'base64url');
  assert.ok(bytes[64] === 27 || bytes[64] === 28, 'signer must emit Ethereum-standard v=27/28');

  bytes[64] -= 27;
  assert.doesNotThrow(() =>
    VerifyMultiSignature(raw, { ...sig, sig: bytes.toString('base64url') })
  );
});

test('EthereumVerifierRejectsOutOfRangeRecoveryId', async () => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Bad recid","items":[{"source":"https://example.com"}]}'
  );
  const sig = await SignMultiEIP191(raw, secretKey, 1, 'feed', '2026-04-13T10:00:00Z');

  // EIP-155 transaction-style v is never produced by personal_sign; reject it
  // rather than silently recovering the wrong key. Matches dp1-go.
  const bytes = Buffer.from(sig.sig, 'base64url');
  bytes[64] = 35;
  assert.throws(
    () => VerifyMultiSignature(raw, { ...sig, sig: bytes.toString('base64url') }),
    /invalid recovery id/
  );
});

// Pins the parse direction: the pre-2.2 layout must NOT verify. Without this the
// verifier could regress to noble's `recovery || r || s` and every test above
// would still pass, since signer and verifier would agree with each other again.
test('EthereumVerifierRejectsLegacyNobleLayout', async () => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Legacy layout","items":[{"source":"https://example.com"}]}'
  );
  const sig = await SignMultiEIP191(raw, secretKey, 1, 'curator', '2026-04-13T10:00:00Z');

  // Re-pack r || s || v back into the noble-specific recovery || r || s layout.
  const std = Buffer.from(sig.sig, 'base64url');
  const legacy = Buffer.alloc(65);
  legacy[0] = std[64] - 27;
  std.copy(legacy, 1, 0, 64);

  assert.throws(() => VerifyMultiSignature(raw, { ...sig, sig: legacy.toString('base64url') }));
});
