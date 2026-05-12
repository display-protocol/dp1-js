import { test } from 'vitest';
import assert from 'node:assert/strict';
import { EthereumAddressToDIDPKH, EthereumAddressFromDIDPKH } from '../../src/sign/index.js';

test('EthereumAddressToDIDPKH', () => {
  assert.ok(
    EthereumAddressToDIDPKH('0xb9c5714089478a327f09197987f16f9e5d936e8a', 1).startsWith(
      'did:pkh:eip155:1:'
    )
  );
});

test('EthereumAddressFromDIDPKH', () => {
  const kid = EthereumAddressToDIDPKH('0xb9c5714089478a327f09197987f16f9e5d936e8a', 1);
  const [addr, chainID] = EthereumAddressFromDIDPKH(kid);
  assert.equal(chainID, 1);
  assert.ok(addr.startsWith('0x'));
});

test('EthereumDIDPKHRoundTrip', () => {
  const kid = EthereumAddressToDIDPKH('0x0000000000000000000000000000000000000000', 5);
  const [addr, chainID] = EthereumAddressFromDIDPKH(kid);
  assert.equal(chainID, 5);
  assert.ok(addr.startsWith('0x'));
});
