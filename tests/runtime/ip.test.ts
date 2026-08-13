import { test } from 'vitest';
import assert from 'node:assert/strict';
import { isIP as nodeIsIP, isIPv4 as nodeIsIPv4, isIPv6 as nodeIsIPv6 } from 'node:net';
import { isIP, isIPv4, isIPv6 } from '../../src/runtime/ip.js';

// `src/runtime/ip.ts` replaces `node:net`'s predicate so the default build carries no Node
// import. The replacement guards SSRF policy, so it is differential-tested against the
// original rather than spot-checked: a case we classify as "not an IP" falls through to the
// DNS branch, which is skipped on runtimes with no resolver.

const FIXED = [
  // IPv4, including the forms inet_pton rejects.
  '0.0.0.0',
  '1.2.3.4',
  '255.255.255.255',
  '256.1.1.1',
  '01.2.3.4',
  '1.2.3.04',
  '1.2.3',
  '1.2.3.4.5',
  '1.2.3.-1',
  ' 1.2.3.4',
  '1.2.3.4 ',
  '1.2.3.4%eth0',
  // IPv6 basics and compression.
  '::',
  '::1',
  '1::',
  '1::2::3',
  '1:2:3:4:5:6:7:8',
  '1:2:3:4:5:6:7',
  '1:2:3:4:5:6:7:8:9',
  '2001:db8::1',
  '2001:0db8:0000:0000:0000:0000:0000:0001',
  'g::1',
  '12345::',
  ':1',
  '1:',
  ':::',
  // IPv4-mapped tails, the shape the URL parser normalizes loopback into.
  '::ffff:127.0.0.1',
  '::ffff:7f00:1',
  '::1.2.3.4',
  '::ffff:1.2.3.256',
  '1:2:3:4:5:6:1.2.3.4',
  '1:2:3:4:5:6:7:1.2.3.4',
  // Zone ids: `net.isIP` accepts them, so a link-local literal stays range-checkable.
  'fe80::1%eth0',
  'fe80::1%',
  '::%',
  '::%a',
  'fe80::1%%x',
  'fe80::1%eth_0',
  'fe80::1%eth 0',
  'fe80::1%[',
  '%eth0',
  '%',
  // Not addresses at all.
  '',
  'localhost',
  'example.com',
  '[::1]',
];

function fuzzCases(count: number) {
  const out: string[] = [];
  const alphabet = '0123456789abcdefABCDEF:.%[]g -_~';
  for (let i = 0; i < count; i++) {
    const length = 1 + Math.floor(Math.random() * 26);
    let value = '';
    for (let j = 0; j < length; j++) {
      value += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    out.push(value);
  }
  return out;
}

function structuredCases(count: number) {
  const out: string[] = [];
  const group = () => Math.floor(Math.random() * 65536).toString(16);
  const octet = () => Math.floor(Math.random() * 300);
  const zoneChars = '0123456789abcdefZ:.-_%[ ';
  for (let i = 0; i < count; i++) {
    const forms = [
      `${group()}:${group()}:${group()}:${group()}:${group()}:${group()}:${group()}:${group()}`,
      `${group()}::${group()}`,
      `::${group()}`,
      `${group()}::`,
      `::ffff:${octet()}.${octet()}.${octet()}.${octet()}`,
      `${group()}:${group()}:${group()}:${group()}:${group()}:${group()}:1.2.3.4`,
      `${octet()}.${octet()}.${octet()}.${octet()}`,
    ];
    let zone = '';
    if (Math.random() < 0.4) {
      const length = 1 + Math.floor(Math.random() * 5);
      zone = '%';
      for (let j = 0; j < length; j++) {
        zone += zoneChars[Math.floor(Math.random() * zoneChars.length)];
      }
    }
    out.push(forms[Math.floor(Math.random() * forms.length)] + zone);
  }
  return out;
}

test('isIP matches node:net on fixed cases', () => {
  for (const value of FIXED) {
    assert.equal(isIP(value), nodeIsIP(value), `isIP(${JSON.stringify(value)})`);
    assert.equal(isIPv4(value), nodeIsIPv4(value), `isIPv4(${JSON.stringify(value)})`);
    assert.equal(isIPv6(value), nodeIsIPv6(value), `isIPv6(${JSON.stringify(value)})`);
  }
});

test('isIP matches node:net under fuzzing', () => {
  for (const value of [...fuzzCases(20_000), ...structuredCases(10_000)]) {
    assert.equal(isIP(value), nodeIsIP(value), `isIP(${JSON.stringify(value)})`);
  }
});

test('isIP classifies link-local literals so the range check can reject them', () => {
  // Were these to read as "not an IP", the guard would hand them to the DNS branch — which is
  // skipped wherever no resolver exists, letting a link-local endpoint through.
  assert.equal(isIP('fe80::1'), 6);
  assert.equal(isIP('fe80::1%eth0'), 6);
  assert.equal(isIP('127.0.0.1'), 4);
  assert.equal(isIP('::ffff:7f00:1'), 6);
});
