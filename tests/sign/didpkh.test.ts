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

  // Uppercasing a mixed-case address is the case that reads like a casing
  // preference but is not one: ethers accepts it (it enforces the checksum only
  // on strings that mix cases), dp1-go rejects it, and this library follows
  // dp1-go. It parsed and verified before this change.
  const caps = '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED';
  assert.throws(() => EthereumAddressFromDIDPKH(`did:pkh:eip155:1:${caps}`), /checksum mismatch/);
});

// The distinction the rule above turns on: "all-uppercase" is not itself the
// rejected thing. These are EIP-55's own "All caps" vectors — every hex letter
// hashes above the threshold, so uppercase *is* their checksummed form. Rejecting
// them would be a real regression, so pin them separately from the mangle above.
test('EthereumAddressFromDIDPKHAcceptsAllCapsWhenThatIsTheChecksum', () => {
  for (const addr of [
    '0x52908400098527886E0F7030069857D2E4169EE7',
    '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
  ]) {
    assert.equal(EthereumAddressFromDIDPKH(`did:pkh:eip155:1:${addr}`)[0], addr);
    assert.equal(EthereumAddressToDIDPKH(addr, 1), `did:pkh:eip155:1:${addr}`);
  }
});

test('EthereumAddressToDIDPKHRejectsInvalidChainID', () => {
  const addr = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
  assert.throws(() => EthereumAddressToDIDPKH(addr, 0), /positive integer/);
  assert.throws(() => EthereumAddressToDIDPKH(addr, -1), /positive integer/);
  // A fractional chain ID would otherwise reach the template literal and build a
  // `did:pkh:eip155:1.5:...` that this library's own parser then rejects.
  assert.throws(() => EthereumAddressToDIDPKH(addr, 1.5), /positive integer/);
  assert.throws(() => EthereumAddressToDIDPKH(addr, NaN), /positive integer/);
});

// The length check was widened to a hex check: 40 non-hex characters used to slip
// through and reach the keccak hashing as garbage.
test('EthereumAddressToDIDPKHRejectsNonHexAddress', () => {
  assert.throws(
    () => EthereumAddressToDIDPKH(`0x${'z'.repeat(40)}`, 1),
    /invalid ethereum address/
  );
});

// The builder can no longer produce a non-positive chain ID, so the parser's own
// guard is only reachable from an identifier that arrived from outside. Cover it
// directly; the address is valid EIP-55 so only the chain ID can be what fires.
test('EthereumAddressFromDIDPKHRejectsInvalidChainID', () => {
  const addr = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
  assert.throws(() => EthereumAddressFromDIDPKH(`did:pkh:eip155:0:${addr}`), /invalid did:pkh/);
  assert.throws(() => EthereumAddressFromDIDPKH(`did:pkh:eip155:-1:${addr}`), /invalid did:pkh/);
});
