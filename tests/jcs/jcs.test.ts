import { test } from 'vitest';
import assert from 'node:assert/strict';
import { JcsTransform } from '../../src/index.js';

test('Transform_ObjectKeyOrder', () => {
  const out = JcsTransform(Buffer.from('{"b":1,"a":2}')).toString('utf8');
  assert.equal(out, '{"a":2,"b":1}');
});

test('Transform_okCases', () => {
  const cases = [
    ['empty_object', '{}', '{}'],
    ['empty_array', '[]', '[]'],
    ['array_preserves_order', '[3,1,2]', '[3,1,2]'],
    ['lexicographic_keys', '{"z":1,"aa":2}', '{"aa":2,"z":1}'],
    ['nested_sorts_keys', '{"outer":{"b":1,"a":2}}', '{"outer":{"a":2,"b":1}}'],
    ['null_in_object', '{"v":null}', '{"v":null}'],
    ['true_in_object', '{"v":true}', '{"v":true}'],
    ['false_in_object', '{"v":false}', '{"v":false}'],
    ['string', '"hello"', '"hello"'],
    ['string_unicode', '"\\u0041"', '"A"'],
    ['object_with_null', '{"x":null}', '{"x":null}'],
    ['integer', '{"n":42}', '{"n":42}'],
    [
      'mixed_types',
      '{"arr":[1,"two",true,null],"obj":{"z":0}}',
      '{"arr":[1,"two",true,null],"obj":{"z":0}}',
    ],
  ] as const;
  for (const [, input, want] of cases) {
    const out = JcsTransform(Buffer.from(input)).toString('utf8');
    assert.equal(out, want);
  }
});

test('Transform_invalidJSON', () => {
  for (const input of ['{"a":', 'undefined', '{"a":1,}']) {
    assert.throws(() => JcsTransform(Buffer.from(input)));
  }
});

test('Transform_idempotent', () => {
  const inBuf = Buffer.from('{"b":[{"y":2,"x":1}],"a":0}');
  const first = JcsTransform(inBuf);
  const second = JcsTransform(first);
  assert.equal(first.toString('utf8'), second.toString('utf8'));
});

test('Transform_whitespace_stripped', () => {
  const out = JcsTransform(Buffer.from('{\n  "b" : 2 ,\n  "a" : 1\n}')).toString('utf8');
  assert.equal(out, '{"a":1,"b":2}');
});

test('Transform_deepNesting', () => {
  let inText = '{"k":';
  inText += '{"k":'.repeat(49);
  inText += '0';
  inText += '}'.repeat(50);
  const out = JcsTransform(Buffer.from(inText));
  const out2 = JcsTransform(out);
  assert.equal(out.toString('utf8'), out2.toString('utf8'));
});
