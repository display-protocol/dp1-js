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

// The reference vectors from EIP-55 itself. dp1-go normalizes to this form via
// go-ethereum's common.Address.Hex(), so matching it byte for byte is what keeps
// `kid` strings identical across the two implementations for the same key.
test('EthereumAddressToDIDPKHEmitsEIP55Checksum', () => {
  const vectors = [
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
    '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
  ];
  for (const want of vectors) {
    assert.equal(EthereumAddressToDIDPKH(want.toLowerCase(), 1), `did:pkh:eip155:1:${want}`);
    assert.equal(EthereumAddressToDIDPKH(want, 1), `did:pkh:eip155:1:${want}`);
  }
});

test('EthereumAddressFromDIDPKHNormalizesToChecksum', () => {
  const checksummed = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

  // All-lowercase input is accepted (dp1-go allows it) and normalized on the way out.
  const [fromLower] = EthereumAddressFromDIDPKH(`did:pkh:eip155:1:${checksummed.toLowerCase()}`);
  assert.equal(fromLower, checksummed);

  const [fromChecksummed] = EthereumAddressFromDIDPKH(`did:pkh:eip155:1:${checksummed}`);
  assert.equal(fromChecksummed, checksummed);
});

test('EthereumAddressFromDIDPKHRejectsBadChecksum', () => {
  // Mixed case that does not satisfy EIP-55 is a corrupted identifier, not a
  // casing preference: reject rather than silently trusting it, as dp1-go does.
  const bad = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD';
  assert.throws(() => EthereumAddressFromDIDPKH(`did:pkh:eip155:1:${bad}`), /checksum mismatch/);
});

test('EthereumAddressToDIDPKHRejectsInvalidChainID', () => {
  const addr = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
  assert.throws(() => EthereumAddressToDIDPKH(addr, 0), /positive integer/);
  assert.throws(() => EthereumAddressToDIDPKH(addr, -1), /positive integer/);
});
