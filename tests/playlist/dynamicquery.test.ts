import { test } from 'vitest';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  PlaylistItemsFromDynamicQuery,
  ResolveDynamicQuery,
  HydrateDynamicQueryString,
  ProfileHTTPSJSONV1,
  ProfileGraphQLV1,
  ErrDynamicQueryHydration,
  ErrDynamicQueryRequest,
  ErrDynamicQueryEndpointPolicy,
  ErrDynamicQueryResponse,
  ErrDynamicQueryItemInvalid,
  ErrDynamicQueryUnknownProfile,
} from '../../src/playlist/index.js';

function startServer(handler: http.RequestListener) {
  const server = http.createServer();
  server.on('request', handler);
  return new Promise<http.Server>(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function serverPort(server: http.Server) {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('server failed to bind');
  return addr.port;
}

function messageStartsWith(prefix: string) {
  return (err: unknown) => err instanceof Error && err.message.startsWith(prefix);
}

test('HydrateDynamicQueryString', () => {
  assert.equal(HydrateDynamicQueryString('owner={{a}}&x={{b}}', { a: '1', b: '2' }), 'owner=1&x=2');
});

test('dynamic query edge cases reject correctly', async () => {
  assert.equal(HydrateDynamicQueryString('', { a: '1' }), '');
  assert.throws(
    () => HydrateDynamicQueryString('{{missing}}', {}),
    messageStartsWith(ErrDynamicQueryHydration.message)
  );
  await assert.rejects(
    () => PlaylistItemsFromDynamicQuery(undefined, null, {}, undefined, null),
    messageStartsWith(ErrDynamicQueryRequest.message)
  );
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        { profile: 'unknown', endpoint: 'http://x', responseMapping: { itemsPath: 'items' } },
        {},
        undefined,
        { AllowInsecureHTTP: true }
      ),
    messageStartsWith(`${ErrDynamicQueryUnknownProfile.message}: "unknown"`)
  );
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: 'http://127.0.0.1/x',
          responseMapping: { itemsPath: 'items' },
        },
        {},
        undefined,
        null
      ),
    messageStartsWith(ErrDynamicQueryEndpointPolicy.message)
  );
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: 'https://[::ffff:127.0.0.1]/x',
          responseMapping: { itemsPath: 'items' },
        },
        {},
        undefined,
        null
      ),
    messageStartsWith(ErrDynamicQueryEndpointPolicy.message)
  );
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: 'https://[fe81::1]/x',
          responseMapping: { itemsPath: 'items' },
        },
        {},
        undefined,
        null
      ),
    messageStartsWith(ErrDynamicQueryEndpointPolicy.message)
  );
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: 'https://[::]/x',
          responseMapping: { itemsPath: 'items' },
        },
        {},
        undefined,
        null
      ),
    messageStartsWith(ErrDynamicQueryEndpointPolicy.message)
  );
});

test('dynamic query error branches match current implementation', async () => {
  const invalidJson = await startServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end('{');
  });
  const endpoint = `http://127.0.0.1:${serverPort(invalidJson)}/x`;
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        { profile: ProfileHTTPSJSONV1, endpoint, responseMapping: { itemsPath: 'items' } },
        {},
        undefined,
        { AllowInsecureHTTP: true }
      ),
    err => err instanceof SyntaxError
  );
  await new Promise(resolve => invalidJson.close(resolve));
});

test('dynamic query itemsPath and item validation cases are surfaced', async () => {
  const srv = await startServer((req, res) => {
    if (req.method === 'POST') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ errors: [{ message: '' }] }));
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({ items: 'not-array', artworks: [{ title: 'Bad', source: 'https://a' }] })
    );
  });
  const endpoint = `http://127.0.0.1:${serverPort(srv)}/gql`;
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileGraphQLV1,
          endpoint,
          query: '',
          responseMapping: { itemsPath: 'data.items' },
        },
        {},
        undefined,
        { AllowInsecureHTTP: true }
      ),
    err =>
      err instanceof Error &&
      err.message.startsWith(ErrDynamicQueryResponse.message) &&
      err.message.includes('graphql error')
  );
  const itemSrv = await startServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: { rows: [{ title: 'Bad' }] } }));
  });
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileGraphQLV1,
          endpoint: `http://127.0.0.1:${serverPort(itemSrv)}/gql`,
          query: '',
          responseMapping: { itemsPath: 'data.rows' },
        },
        {},
        undefined,
        { AllowInsecureHTTP: true }
      ),
    err => err instanceof Error && err.message.startsWith(ErrDynamicQueryItemInvalid.message)
  );
  await new Promise(resolve => itemSrv.close(resolve));
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        { profile: ProfileHTTPSJSONV1, endpoint, responseMapping: { itemsPath: 'items' } },
        {},
        undefined,
        { AllowInsecureHTTP: true }
      ),
    err =>
      err instanceof Error &&
      err.message.startsWith(ErrDynamicQueryResponse.message) &&
      err.message.includes('itemsPath "items" is not an array')
  );
  await new Promise(resolve => srv.close(resolve));
});

test('dynamic query resolution branches surface nil playlist and network failures', async () => {
  await assert.rejects(
    () => ResolveDynamicQuery(null, undefined, {}, undefined, null),
    messageStartsWith('dynamicQuery: build request: nil playlist')
  );
  const noQuery = { dpVersion: '1.1.0', title: 'x', items: [{ source: 'https://a' }] };
  const out = await ResolveDynamicQuery(noQuery, undefined, {}, undefined, null);
  assert.deepEqual(out, noQuery);

  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        { signal: undefined },
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: 'http://example.invalid/x',
          responseMapping: { itemsPath: 'items' },
        },
        {},
        {
          fetch: async () => {
            throw new Error('boom');
          },
        },
        { AllowInsecureHTTP: true }
      ),
    err => err instanceof Error && err.message.startsWith('dynamicQuery: http: boom')
  );

  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: 'http://example.invalid/x',
          responseMapping: { itemsPath: 'items' },
        },
        {},
        {
          fetch: async () => {
            const response = new Response('{}', {
              headers: { 'content-type': 'application/json' },
            });
            Object.defineProperty(response, 'arrayBuffer', {
              value: async () => {
                throw new Error('read failed');
              },
            });
            return response;
          },
        },
        { AllowInsecureHTTP: true }
      ),
    err =>
      err instanceof Error &&
      (err.message.startsWith('dynamicQuery: http:') || err.message === 'read failed')
  );

  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: 'http://example.invalid/x',
          responseMapping: { itemsPath: 'items' },
        },
        {},
        {
          fetch: async () =>
            new Response('', {
              status: 500,
              headers: { 'content-type': 'application/json' },
            }),
        },
        { AllowInsecureHTTP: true }
      ),
    err => err instanceof Error && err.message.includes('status 500')
  );

  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: 'http://example.invalid/x',
          method: 'POST',
          responseMapping: { itemsPath: 'items' },
        },
        {},
        undefined,
        { AllowInsecureHTTP: true }
      ),
    err =>
      err instanceof Error &&
      (err.message.startsWith('dynamicQuery: http: fetch failed') ||
        err.message.startsWith(ErrDynamicQueryRequest.message))
  );
});

test('dynamic query full branch coverage', async () => {
  const getSrv = await startServer((req, res) => {
    if (req.url === '/artworks?chain=ethereum&owner=0xabc') {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          artworks: [
            {
              id: '385f79b6-a45f-4c1c-8080-e93a192adccc',
              title: 'T',
              source: 'https://media.example/x',
            },
          ],
        })
      );
      return;
    }
    res.statusCode = 500;
    res.end('unexpected');
  });
  const endpoint = `http://127.0.0.1:${serverPort(getSrv)}/artworks`;
  const dq = {
    profile: ProfileHTTPSJSONV1,
    endpoint,
    query: 'chain=ethereum&owner={{owner}}',
    responseMapping: { itemsPath: 'artworks' },
  };
  const items = await PlaylistItemsFromDynamicQuery(undefined, dq, { owner: '0xabc' }, undefined, {
    AllowInsecureHTTP: true,
  });
  assert.equal(items.length, 1);

  const p = {
    dpVersion: '1.1.0',
    title: 't',
    items: [{ source: 'https://static.example/a' }],
    dynamicQuery: dq,
  };
  const out = (await ResolveDynamicQuery(p, undefined, { owner: '0xabc' }, undefined, {
    AllowInsecureHTTP: true,
  })) as {
    items: Array<{ source: string }>;
    Items?: unknown;
  };
  assert.equal(out.items.length, 2);
  assert.equal('Items' in out, false);

  const mapSrv = await startServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        items: [
          { _id: '385f79b6-a45f-4c1c-8080-e93a192adccc', title: 'Mapped', source: 'https://m' },
        ],
      })
    );
  });
  const mapped = await PlaylistItemsFromDynamicQuery(
    undefined,
    {
      profile: ProfileHTTPSJSONV1,
      endpoint: `http://127.0.0.1:${serverPort(mapSrv)}/json`,
      responseMapping: { itemsPath: 'items', itemMap: { id: '_id' } },
    },
    {},
    undefined,
    { AllowInsecureHTTP: true }
  );
  assert.equal(mapped[0].id, '385f79b6-a45f-4c1c-8080-e93a192adccc');

  const dotSrv = await startServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: { rows: [{ title: 'Dot', source: 'https://x' }] } }));
  });
  const dot = await PlaylistItemsFromDynamicQuery(
    undefined,
    {
      profile: ProfileGraphQLV1,
      endpoint: `http://127.0.0.1:${serverPort(dotSrv)}/gql`,
      query: 'query { rows { title source } }',
      responseMapping: { itemsPath: 'data.rows' },
    },
    {},
    undefined,
    { AllowInsecureHTTP: true }
  );
  assert.equal(dot.length, 1);

  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileGraphQLV1,
          endpoint: `http://127.0.0.1:${serverPort(dotSrv)}/gql`,
          query: '',
          responseMapping: { itemsPath: 'data.items' },
        },
        {},
        undefined,
        { AllowInsecureHTTP: true }
      ),
    err =>
      err instanceof Error &&
      (err.message.includes('graphql error') || err.message.includes('missing key "items"'))
  );

  const badSrv = await startServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ items: [{ title: 'Bad' }] }));
  });
  await assert.rejects(
    () =>
      PlaylistItemsFromDynamicQuery(
        undefined,
        {
          profile: ProfileHTTPSJSONV1,
          endpoint: `http://127.0.0.1:${serverPort(badSrv)}/json`,
          responseMapping: { itemsPath: 'items' },
        },
        {},
        undefined,
        { AllowInsecureHTTP: true }
      ),
    err => err instanceof Error && err.message.includes('invalid playlist item')
  );

  await Promise.all([
    new Promise(resolve => getSrv.close(resolve)),
    new Promise(resolve => mapSrv.close(resolve)),
    new Promise(resolve => dotSrv.close(resolve)),
    new Promise(resolve => badSrv.close(resolve)),
  ]);
});

test('dynamic query resolution passes ctx signal and keeps canonical items', async () => {
  const controller = new AbortController();
  const p = {
    dpVersion: '1.1.0',
    title: 't',
    items: [{ source: 'https://static.example/a' }],
    dynamicQuery: {
      profile: ProfileHTTPSJSONV1,
      endpoint: 'http://example.invalid/x',
      responseMapping: { itemsPath: 'artworks' },
    },
  };
  let receivedSignal: AbortSignal | null | undefined;
  const out = (await ResolveDynamicQuery(
    p,
    { signal: controller.signal },
    {},
    {
      fetch: async (_url, init) => {
        receivedSignal = init?.signal;
        return new Response(
          JSON.stringify({
            artworks: [{ title: 'Resolved', source: 'https://media.example/resolved' }],
          }),
          { headers: { 'content-type': 'application/json' } }
        );
      },
    },
    { AllowInsecureHTTP: true }
  )) as {
    items: Array<{ source: string }>;
    Items?: unknown;
  };
  assert.equal(receivedSignal, controller.signal);
  assert.equal(out.items.length, 2);
  assert.equal('Items' in out, false);
});
