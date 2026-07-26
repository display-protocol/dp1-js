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

test('EthereumSignerEmitsStandardWireFormat', async () => {
  // The EIP-191 wire format is [r(32), s(32), v(1)] with v in {27,28} — the
  // layout viem/ethers/MetaMask and go-ethereum use. dp1-js previously emitted
  // @noble/curves' library-private [recovery(1), r, s] with recovery in {0,1},
  // which no other DP-1 implementation could verify. Lock the standard layout.
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Wire Format","items":[{"source":"https://example.com/art.html"}]}'
  );
  const sig = await SignMultiEIP191(raw, secretKey, 1, 'curator', '2026-04-13T10:00:00Z');
  const bytes = Buffer.from(sig.sig, 'base64url');
  assert.equal(bytes.length, 65);
  assert.ok(bytes[64] === 27 || bytes[64] === 28, `v must be 27/28, got ${bytes[64]}`);
});

test('EthereumVerifierAcceptsBothRecoveryConventions', async () => {
  // Regression: the verifier passed the raw 65-byte signature to
  // recoverPublicKey without extracting/normalizing the recovery id, so a
  // wallet's {27,28} v threw "invalid recovery id" and every real wallet
  // signature was rejected. Verify both the {27,28} form (wallets, standard)
  // and the {0,1} form (some libraries) recover the same signer.
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Recovery Conventions","items":[{"source":"https://example.com/art.html"}]}'
  );
  const sig = await SignMultiEIP191(raw, secretKey, 1, 'curator', '2026-04-13T10:00:00Z');
  const bytes = Buffer.from(sig.sig, 'base64url'); // standard {27,28} from the signer
  assert.doesNotThrow(() => VerifyMultiSignature(raw, sig));

  // Same signature with v mapped to the {0,1} convention must also verify.
  const alt = Buffer.from(bytes);
  alt[64] = bytes[64] - 27;
  assert.doesNotThrow(() => VerifyMultiSignature(raw, { ...sig, sig: alt.toString('base64url') }));
});

test('EthereumVerifierRejectsOutOfRangeRecoveryId', async () => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const raw = Buffer.from(
    '{"dpVersion":"1.1.0","title":"Bad Recovery","items":[{"source":"https://example.com"}]}'
  );
  const sig = await SignMultiEIP191(raw, secretKey, 1, 'feed', '2026-04-13T10:00:00Z');
  const bytes = Buffer.from(sig.sig, 'base64url');
  bytes[64] = 42; // neither {0,1} nor {27,28}
  const bad = { ...sig, sig: bytes.toString('base64url') };
  assert.throws(() => VerifyMultiSignature(raw, bad));
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
