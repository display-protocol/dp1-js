import { test } from 'vitest';
import assert from 'node:assert/strict';
import { ucs2length } from '../../../src/validate/runtime.js';
import { Playlist } from '../../../src/validate/index.js';

// `minLength` / `maxLength` count Unicode code points, not UTF-16 units. The precompiled
// validators call this helper for both, so it is pinned here rather than only through a schema.
test('ucs2length counts code points', () => {
  assert.equal(ucs2length(''), 0);
  assert.equal(ucs2length('abc'), 3);
  assert.equal(ucs2length('é'), 1);
  assert.equal(ucs2length('😀'), 1, 'a surrogate pair is one code point');
  assert.equal(ucs2length('a😀b'), 3);
  assert.equal(ucs2length('\ud83d'), 1, 'a lone high surrogate still counts once');
  assert.equal(ucs2length('\udc00\ud83d'), 2, 'out-of-order surrogates are not a pair');
  for (const value of ['', 'abc', '😀😀', 'a\ud83d😀'])
    assert.equal(ucs2length(value), [...value].length, value);
});

test('title maxLength applies to code points', () => {
  const doc = (title: string) =>
    JSON.stringify({ dpVersion: '1.1.0', title, items: [{ source: 'https://a' }] });
  // 200 emoji are 400 UTF-16 units but 200 code points, so the 200-char limit accepts them.
  assert.doesNotThrow(() => Playlist(doc('😀'.repeat(200)), { requireSignatures: false }));
  assert.throws(() => Playlist(doc('😀'.repeat(201)), { requireSignatures: false }));
});
