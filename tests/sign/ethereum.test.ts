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
