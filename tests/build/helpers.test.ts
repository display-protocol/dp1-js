import { test } from 'vitest';
import assert from 'node:assert/strict';
import { resolve, slugify, assertHexColor } from '../../src/build/helpers.js';

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

