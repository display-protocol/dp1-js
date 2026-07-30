import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  resolve,
  slugify,
  assertHexColor,
  assertHex64,
  assert0xHex,
  assertUri,
} from '../../src/build/helpers.js';

test('slugify produces kebab-case', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
  assert.equal(slugify('  multiple   spaces  '), 'multiple-spaces');
  assert.throws(() => slugify('---'), /empty slug/i);
});

test('resolve unwraps builders', () => {
  const x = resolve({ build: () => ({ a: 1 }) });
  assert.deepEqual(x, { a: 1 });
  assert.equal(resolve(123), 123);
});

test('assertHexColor enforces #RRGGBB', () => {
  assert.doesNotThrow(() => assertHexColor('#111111'));
  assert.doesNotThrow(() => assertHexColor('transparent'));
  assert.throws(() => assertHexColor('#111'), /#RRGGBB/i);
});

test('assertHex64 requires lowercase digests', () => {
  assert.equal(
    assertHex64('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'h'),
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  );
  assert.throws(
    () => assertHex64('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'h'),
    /lowercase/i
  );
});

test('assert0xHex requires lowercase', () => {
  assert.equal(assert0xHex('0xabc', 's'), '0xabc');
  assert.throws(() => assert0xHex('0xABC', 's'), /lowercase/i);
});

test('assertUri rejects non-absolute values', () => {
  assert.doesNotThrow(() => assertUri('ipfs://Qmabc', 'u'));
  assert.throws(() => assertUri('not-a-uri', 'u'), /uri/i);
});
