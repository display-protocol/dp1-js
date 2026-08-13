import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import {
  PlaylistItemsFromDynamicQuery,
  ErrDynamicQueryEndpointPolicy,
} from '../../src/playlist/index.js';
import { platformResolver, resetPlatformResolver } from '../../src/runtime/dns.js';

// The dynamic-query SSRF guard resolves the endpoint host and rejects private addresses.
// `dns.lookup` has no browser or Workers equivalent, so the resolver became a seam: injected
// via `client.lookup`, or found automatically on Node. These tests pin both halves, and pin
// that the URL-level checks keep running where no resolver exists.

const ITEM = {
  source: 'https://cdn.example/artwork.html',
  duration: 30,
  license: 'open' as const,
};

function okFetch() {
  const calls: string[] = [];
  const impl = async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ items: [ITEM] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetch: impl as unknown as typeof fetch };
}

const DQ = {
  profile: 'https-json-v1',
  endpoint: 'https://feed.example.com/artworks',
  responseMapping: { itemsPath: 'items' },
};

async function withoutPlatformResolver<T>(body: () => Promise<T>): Promise<T> {
  // Stand in for a browser or a Worker: no `process.getBuiltinModule`, so no resolver.
  const proc = globalThis.process as { getBuiltinModule?: unknown };
  const original = proc.getBuiltinModule;
  delete proc.getBuiltinModule;
  resetPlatformResolver();
  try {
    return await body();
  } finally {
    proc.getBuiltinModule = original;
    resetPlatformResolver();
  }
}

afterEach(() => resetPlatformResolver());

test('Node finds a platform resolver automatically, with no node: import', async () => {
  const resolve = platformResolver();
  assert.ok(resolve, 'Node 22.3+ should expose dns via process.getBuiltinModule');
  const addrs = await resolve('localhost');
  assert.ok(addrs.length > 0);
  assert.ok(addrs.every(a => typeof a.address === 'string' && typeof a.family === 'number'));
});

test('an injected resolver overrides the platform one', async () => {
  const seen: string[] = [];
  const client = {
    ...okFetch(),
    lookup: async (host: string) => {
      seen.push(host);
      return [{ address: '93.184.216.34', family: 4 }];
    },
  };
  const items = await PlaylistItemsFromDynamicQuery(undefined, DQ, {}, client, null);
  assert.deepEqual(seen, ['feed.example.com']);
  assert.equal(items.length, 1);
});

test('a host resolving into a private range is rejected', async () => {
  for (const address of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254']) {
    await assert.rejects(
      () =>
        PlaylistItemsFromDynamicQuery(
          undefined,
          DQ,
          {},
          { ...okFetch(), lookup: async () => [{ address, family: 4 }] },
          null
        ),
      (err: Error) => err.message.startsWith(ErrDynamicQueryEndpointPolicy.message),
      address
    );
  }
});

test('one private address among public ones still rejects the host', async () => {
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        DQ,
        {},
        {
          ...okFetch(),
          lookup: async () => [
            { address: '93.184.216.34', family: 4 },
            { address: '127.0.0.1', family: 4 },
          ],
        },
        null
      ),
    (err: Error) => err.message.startsWith(ErrDynamicQueryEndpointPolicy.message)
  );
});

test('a resolver that fails or answers empty is a policy error, not a pass', async () => {
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        DQ,
        {},
        {
          ...okFetch(),
          lookup: async () => {
            throw new Error('ENOTFOUND');
          },
        },
        null
      ),
    (err: Error) =>
      err.message.startsWith(ErrDynamicQueryEndpointPolicy.message) &&
      err.message.includes('ENOTFOUND')
  );

  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        DQ,
        {},
        { ...okFetch(), lookup: async () => [] },
        null
      ),
    (err: Error) => err.message.includes('host has no addresses')
  );
});

test('the fetch is never issued when the resolver rejects the host', async () => {
  const client = { ...okFetch(), lookup: async () => [{ address: '127.0.0.1', family: 4 }] };
  await assert.rejects(() => PlaylistItemsFromDynamicQuery(undefined, DQ, {}, client, null));
  assert.deepEqual(client.calls, [], 'the guard must run before the request');
});

test('without a resolver the URL-level checks still reject every disallowed endpoint', async () => {
  await withoutPlatformResolver(async () => {
    assert.equal(platformResolver(), null, 'this run must have no resolver');

    const disallowed = [
      ['plain http', 'http://feed.example.com/x'],
      ['userinfo', 'https://user:pass@feed.example.com/x'],
      ['fragment', 'https://feed.example.com/x#frag'],
      ['unsupported scheme', 'ftp://feed.example.com/x'],
      // IP literals are checked without any resolver at all.
      ['loopback literal', 'https://127.0.0.1/x'],
      ['private literal', 'https://10.0.0.1/x'],
      ['link-local metadata literal', 'https://169.254.169.254/x'],
      ['ipv6 loopback literal', 'https://[::1]/x'],
      ['ipv4-mapped loopback literal', 'https://[::ffff:127.0.0.1]/x'],
      ['ipv6 unique-local literal', 'https://[fd00::1]/x'],
    ] as const;

    for (const [label, endpoint] of disallowed) {
      const client = okFetch();
      await assert.rejects(
        () => PlaylistItemsFromDynamicQuery(undefined, { ...DQ, endpoint }, {}, client, null),
        (err: Error) => err.message.startsWith(ErrDynamicQueryEndpointPolicy.message),
        label
      );
      assert.deepEqual(client.calls, [], `${label}: must not reach fetch`);
    }
  });
});

test('without a resolver a public hostname proceeds — the documented weaker guarantee', async () => {
  await withoutPlatformResolver(async () => {
    const client = okFetch();
    const items = await PlaylistItemsFromDynamicQuery(undefined, DQ, {}, client, null);
    assert.equal(items.length, 1);
    assert.deepEqual(client.calls, ['https://feed.example.com/artworks']);
  });
});

test('injecting a resolver restores the check on a runtime that has none', async () => {
  await withoutPlatformResolver(async () => {
    await assert.rejects(
      () =>
        PlaylistItemsFromDynamicQuery(
          undefined,
          DQ,
          {},
          { ...okFetch(), lookup: async () => [{ address: '10.1.2.3', family: 4 }] },
          null
        ),
      (err: Error) => err.message.startsWith(ErrDynamicQueryEndpointPolicy.message)
    );
  });
});
