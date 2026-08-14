import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import {
  PlaylistItemsFromDynamicQuery,
  ErrDynamicQueryEndpointPolicy,
} from '../../src/playlist/index.js';
import { lookup as nodeLookup } from 'node:dns/promises';
import {
  platformResolver,
  resetPlatformResolver,
  resolveAddresses,
} from '../../src/runtime/dns.js';

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
  const addrs = await resolveAddresses(resolve, 'localhost');
  assert.ok(addrs.length > 0);
  assert.ok(addrs.every(a => typeof a.address === 'string' && typeof a.family === 'number'));
});

// The README documents `client.lookup` as "shaped like dns.lookup(host, { all: true })", so
// handing it `dns.promises.lookup` verbatim has to work. It previously did not: the seam
// called `resolve(host)` with no options, so Node answered with a single { address, family }
// object rather than an array, and every hostname failed with "host has no addresses".

test('dns.promises.lookup can be injected verbatim', async () => {
  const addrs = await resolveAddresses(nodeLookup, 'localhost');
  assert.ok(Array.isArray(addrs), 'expected an address list');
  assert.ok(addrs.length > 0);
  assert.ok(addrs.every(a => typeof a.address === 'string' && typeof a.family === 'number'));
});

test('the seam requests every address, not just the first', async () => {
  // `{ all: true }` is a security requirement, not a shape detail: without it `dns.lookup`
  // answers with a single address, so a host publishing both a public and a private record
  // would have the private one go unchecked.
  let received: unknown;
  const resolve = async (_host: string, options: { all: true }) => {
    received = options;
    return [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ];
  };
  const addrs = await resolveAddresses(resolve, 'feed.example.com');
  assert.deepEqual(received, { all: true }, 'the resolver must be asked for all addresses');
  assert.equal(addrs.length, 2, 'every address must reach the range check');
});

test('a resolver that ignores { all: true } is still read correctly', async () => {
  // Some resolvers answer with the bare single-address object. Reading that as "no addresses"
  // would fail the check open on the next call that happened to return one.
  const single = async () => ({ address: '93.184.216.34', family: 4 });
  assert.deepEqual(await resolveAddresses(single, 'feed.example.com'), [
    { address: '93.184.216.34', family: 4 },
  ]);
});

test('an unreadable resolver answer is an error, never an empty pass', async () => {
  for (const answer of [null, undefined, 'nope', 42, {}]) {
    await assert.rejects(
      () => resolveAddresses((async () => answer) as never, 'feed.example.com'),
      TypeError,
      JSON.stringify(answer)
    );
  }
});

test('an injected dns.promises.lookup enforces the private-address check end to end', async () => {
  // localhost resolves to loopback, so the guard must reject it — proving the injected
  // resolver is genuinely driving policy, not just being called.
  const client = { ...okFetch(), lookup: nodeLookup };
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        { ...DQ, endpoint: 'https://localhost/artworks' },
        {},
        client,
        null
      ),
    (err: Error) => err.message.startsWith(ErrDynamicQueryEndpointPolicy.message)
  );
  assert.deepEqual(client.calls, [], 'the guard must run before the request');
});

test('an injected resolver overrides the platform one', async () => {
  const seen: string[] = [];
  const client = {
    ...okFetch(),
    lookup: async (host: string, options: { all: true }) => {
      // The seam must pass the dns.lookup options through on every call.
      assert.deepEqual(options, { all: true });
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

// `AllowInsecureHTTP` is a development escape hatch, not a scheme exemption: it stands down the
// private-address policy as well, which is what lets the dynamicQuery suite talk to local test
// servers on http://127.0.0.1:port. Long-standing behaviour, previously implicit — pinned here
// so it is a decision on the record rather than an accident, and so that tightening it later is
// a visible, deliberate test change.

test('AllowInsecureHTTP stands down the address policy, literals included', async () => {
  for (const endpoint of [
    'http://127.0.0.1:8080/x',
    'http://10.0.0.1/x',
    'http://169.254.169.254/x',
    'http://[::1]/x',
    'https://127.0.0.1/x',
  ]) {
    const client = okFetch();
    const items = await PlaylistItemsFromDynamicQuery(undefined, { ...DQ, endpoint }, {}, client, {
      AllowInsecureHTTP: true,
    });
    assert.equal(items.length, 1, endpoint);
    assert.equal(client.calls.length, 1, `${endpoint}: should reach fetch`);
  }
});

test('AllowInsecureHTTP does not skip a resolver when one is injected', async () => {
  // The address policy stands down, so the resolver is not consulted at all — the request goes
  // straight out. Pinned because "insecure implies unchecked" must be the whole story: a caller
  // must not be able to believe an injected resolver is still guarding them here.
  const seen: string[] = [];
  const client = {
    ...okFetch(),
    lookup: async (host: string) => {
      seen.push(host);
      return [{ address: '127.0.0.1', family: 4 }];
    },
  };
  const items = await PlaylistItemsFromDynamicQuery(
    undefined,
    { ...DQ, endpoint: 'http://internal.corp/artworks' },
    {},
    client,
    { AllowInsecureHTTP: true }
  );
  assert.equal(items.length, 1);
  assert.deepEqual(seen, [], 'no resolution happens once the policy has stood down');
});

test('the escape hatch is opt-in: unset means the policy is fully active', async () => {
  // The mirror image of the two tests above, so a regression that flipped the default would
  // fail here rather than silently widening the guard.
  for (const endpoint of ['http://127.0.0.1:8080/x', 'https://127.0.0.1/x', 'https://[::1]/x']) {
    const client = okFetch();
    await assert.rejects(
      () => PlaylistItemsFromDynamicQuery(undefined, { ...DQ, endpoint }, {}, client, null),
      (err: Error) => err.message.startsWith(ErrDynamicQueryEndpointPolicy.message),
      endpoint
    );
    assert.deepEqual(client.calls, [], `${endpoint}: must not reach fetch`);
  }
});
