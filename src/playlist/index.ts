import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Buffer } from 'node:buffer';
import { parsePlaylistItem } from '../validate/index.js';

export const RoleCurator = 'curator';
export const RoleFeed = 'feed';
export const RoleAgent = 'agent';
export const RoleInstitution = 'institution';
export const RoleLicensor = 'licensor';
export const AlgEd25519 = 'ed25519';
export const AlgEIP191 = 'eip191';
export const AlgECDSASecp256k1 = 'ecdsa-secp256k1';
export const AlgECDSAP256 = 'ecdsa-p256';
export const ProfileHTTPSJSONV1 = 'https-json-v1';
export const ProfileGraphQLV1 = 'graphql-v1';

export const ErrDynamicQueryUnknownProfile = new Error('dynamicQuery: unknown profile');
export const ErrDynamicQueryHydration = new Error('dynamicQuery: hydration');
export const ErrDynamicQueryRequest = new Error('dynamicQuery: build request');
export const ErrDynamicQueryHTTP = new Error('dynamicQuery: http');
export const ErrDynamicQueryResponse = new Error('dynamicQuery: response');
export const ErrDynamicQueryItemInvalid = new Error('dynamicQuery: invalid playlist item');
export const ErrDynamicQueryEndpointPolicy = new Error('dynamicQuery: endpoint policy');

const placeholderRE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

type PlaylistLike =
  | {
      dpVersion?: unknown;
      title?: unknown;
      items?: unknown;
      DynamicQuery?: unknown;
      dynamicQuery?: unknown;
      Items?: unknown;
    }
  | null
  | undefined;

type NetAddressLike = { address?: string; family?: number | string } | null | undefined;
type DynamicQueryResponseMappingLike =
  | {
      ItemsPath?: string;
      itemsPath?: string;
      ItemMap?: Record<string, string>;
      itemMap?: Record<string, string>;
    }
  | undefined;
type DynamicQueryLike =
  | {
      Profile?: string;
      profile?: string;
      Endpoint?: string;
      endpoint?: string;
      Method?: string;
      method?: string;
      Headers?: HeadersInit;
      headers?: HeadersInit;
      Query?: string;
      query?: string;
      ResponseMapping?: DynamicQueryResponseMappingLike;
      responseMapping?: DynamicQueryResponseMappingLike;
    }
  | null
  | undefined;

export function parsePlaylist(doc: PlaylistLike) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new Error('dp1: playlist must be an object');
  if (typeof doc.dpVersion !== 'string')
    throw new Error('dp1: playlist.dpVersion must be a string');
  if (typeof doc.title !== 'string') throw new Error('dp1: playlist.title must be a string');
  if (!Array.isArray(doc.items)) throw new Error('dp1: playlist.items must be an array');
  for (const item of doc.items) {
    if (!item || typeof item !== 'object') throw new Error('dp1: playlist item must be an object');
    if (typeof item.source !== 'string')
      throw new Error('dp1: playlist item.source must be a string');
  }
  return doc;
}

export function clonePlaylist(p: PlaylistLike) {
  return structuredClone(p);
}

export class PlaylistDocument {
  constructor(data: PlaylistLike = {}) {
    Object.assign(this, structuredClone(data));
  }

  static fromJSON(data: PlaylistLike) {
    return new PlaylistDocument(data);
  }

  ResolveDynamicQuery(
    ctx: unknown,
    params: Record<string, string>,
    client: { fetch?: typeof fetch } | undefined,
    opts: { AllowInsecureHTTP?: boolean } | null | undefined
  ) {
    return ResolveDynamicQuery(this as PlaylistLike, ctx, params, client, opts);
  }
}

export function HydrateDynamicQueryString(query: string, params: Record<string, string> = {}) {
  if (!query) return '';
  const names = [...new Set([...query.matchAll(placeholderRE)].map(m => m[1]))];
  const missing = names.filter(name => !(name in params));
  if (missing.length)
    throw new Error(
      `${ErrDynamicQueryHydration.message}: missing params for placeholders: ${missing.join(', ')}`
    );
  return query.replace(placeholderRE, (_, name) => params[name]);
}

function defaultHTTPMethod(profile: string, explicit?: string) {
  if (explicit) return explicit;
  return profile === ProfileGraphQLV1 ? 'POST' : 'GET';
}

function isPublicIPv4Address(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  if (parts[0] === 10 || parts[0] === 127) return false;
  if (parts[0] === 169 && parts[1] === 254) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] === 0) return false;
  return true;
}

function ipv4MappedAddress(address: string) {
  const match = /^::ffff:(.+)$/.exec(address);
  if (!match) return null;
  const tail = match[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(tail)) return tail;
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(tail);
  if (!hex) return null;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
}

function endpointIPAllowedProduction(addr: NetAddressLike) {
  if (!addr || !addr.address) return false;
  const fam = addr.family;
  if (fam === 4) {
    return isPublicIPv4Address(addr.address);
  }
  if (fam === 6) {
    const a = addr.address.toLowerCase();
    if (a === '::1') return false;
    if (a === '::') return false;
    if (a.startsWith('ff')) return false;
    if (a.startsWith('fc') || a.startsWith('fd') || /^fe[89ab]/.test(a)) return false;
    const mapped = ipv4MappedAddress(a);
    return mapped ? isPublicIPv4Address(mapped) : true;
  }
  return false;
}

async function validateDNSHostProduction(_ctx: unknown, host: string) {
  const addrs = await dnsLookup(host, { all: true });
  if (!addrs.length)
    throw new Error(`${ErrDynamicQueryEndpointPolicy.message}: host has no addresses`);
  for (const ip of addrs) {
    if (!endpointIPAllowedProduction(ip))
      throw new Error(
        `${ErrDynamicQueryEndpointPolicy.message}: host resolves to non-public address`
      );
  }
}

async function validateDynamicQueryRequestURL(
  ctx: unknown,
  u: URL,
  opts: { AllowInsecureHTTP?: boolean } | null | undefined
) {
  if (!u) throw new Error(`${ErrDynamicQueryEndpointPolicy.message}: nil URL`);
  const allowInsecure = !!opts?.AllowInsecureHTTP;
  if (!/^https?:$/.test(u.protocol))
    throw new Error(`${ErrDynamicQueryEndpointPolicy.message}: unsupported scheme "${u.protocol}"`);
  if (u.username || u.password)
    throw new Error(`${ErrDynamicQueryEndpointPolicy.message}: URL must not include user info`);
  if (u.hash)
    throw new Error(`${ErrDynamicQueryEndpointPolicy.message}: URL must not include a fragment`);
  if (u.protocol === 'http:' && !allowInsecure)
    throw new Error(
      `${ErrDynamicQueryEndpointPolicy.message}: only https is allowed (set AllowInsecureHTTP for http)`
    );
  if (allowInsecure) return;
  const host =
    u.hostname.startsWith('[') && u.hostname.endsWith(']') ? u.hostname.slice(1, -1) : u.hostname;
  if (isIP(host)) {
    if (!endpointIPAllowedProduction({ address: host, family: isIP(host) })) {
      throw new Error(`${ErrDynamicQueryEndpointPolicy.message}: non-public endpoint address`);
    }
    return;
  }
  await validateDNSHostProduction(ctx, host);
}

async function buildDynamicQueryRequest(
  _ctx: unknown,
  dq: DynamicQueryLike,
  hydratedQuery: string
) {
  if (!dq) throw new Error(`${ErrDynamicQueryRequest.message}: nil dynamicQuery`);
  const profile = String(dq.Profile || dq.profile || '');
  const endpoint = dq.Endpoint || dq.endpoint;
  if (!endpoint) throw new Error(`${ErrDynamicQueryRequest.message}: missing endpoint`);
  const endpointURL = String(endpoint);
  const method = defaultHTTPMethod(profile, dq.Method || dq.method);
  const headers = new Headers(dq.Headers || dq.headers || {});
  if (profile === ProfileGraphQLV1) {
    if (method !== 'POST')
      throw new Error(`${ErrDynamicQueryRequest.message}: graphql-v1 expects POST`);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return {
      url: endpointURL,
      method,
      headers,
      body: JSON.stringify({ query: hydratedQuery || '' }),
    };
  }
  if (profile !== ProfileHTTPSJSONV1)
    throw new Error(`${ErrDynamicQueryUnknownProfile.message}: "${profile}"`);
  if (method === 'GET') {
    const u = new URL(endpointURL);
    if (hydratedQuery) {
      const extra = new URLSearchParams(hydratedQuery);
      for (const [k, v] of extra.entries()) u.searchParams.append(k, v);
    }
    return { url: u.toString(), method, headers, body: undefined };
  }
  if (method === 'POST') {
    if (hydratedQuery && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    return { url: endpointURL, method, headers, body: hydratedQuery || undefined };
  }
  throw new Error(
    `${ErrDynamicQueryRequest.message}: unsupported method ${method} for https-json-v1`
  );
}

async function fetchDynamicQueryResponseBody(
  ctx: unknown,
  dq: DynamicQueryLike,
  params: Record<string, string> | undefined,
  client: { fetch?: typeof fetch } | undefined,
  opts: { AllowInsecureHTTP?: boolean } | null | undefined
) {
  const hydrated = HydrateDynamicQueryString(dq?.Query || dq?.query || '', params || {});
  const req = await buildDynamicQueryRequest(ctx, dq, hydrated);
  await validateDynamicQueryRequestURL(ctx, new URL(req.url), opts);
  const fetchImpl =
    client && typeof client.fetch === 'function' ? client.fetch.bind(client) : fetch;
  let response: Response;
  try {
    response = await fetchImpl(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: (ctx as { signal?: AbortSignal } | null | undefined)?.signal,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${ErrDynamicQueryHTTP.message}: ${message}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${ErrDynamicQueryHTTP.message}: status ${response.status}`);
  return body;
}

function jsonAtDotPath(root: unknown, path: string) {
  let cur = root;
  for (const segment of path.split('.')) {
    if (!segment) continue;
    if (!cur || typeof cur !== 'object' || Array.isArray(cur))
      throw new Error(`expected object at segment "${segment}"`);
    if (!(segment in cur)) throw new Error(`missing key "${segment}"`);
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

function graphqlPayload(body: Buffer) {
  const env = JSON.parse(Buffer.from(body).toString('utf8')) as {
    errors?: Array<{ message?: string }>;
    data?: unknown;
  };
  if (Array.isArray(env.errors) && env.errors.length)
    throw new Error(
      `${ErrDynamicQueryResponse.message}: graphql: ${env.errors[0].message || 'graphql error'}`
    );
  return env.data;
}

function extractDynamicItems(
  body: Buffer,
  profile: string,
  rm: { ItemsPath?: string; itemsPath?: string } | undefined
) {
  const root = JSON.parse(Buffer.from(body).toString('utf8'));
  if (profile === ProfileGraphQLV1) graphqlPayload(body);
  const itemsPath = rm?.ItemsPath || rm?.itemsPath;
  if (!itemsPath) throw new Error(`${ErrDynamicQueryResponse.message}: missing itemsPath`);
  const at = jsonAtDotPath(root, itemsPath);
  if (!Array.isArray(at))
    throw new Error(`${ErrDynamicQueryResponse.message}: itemsPath "${itemsPath}" is not an array`);
  return at.map(el => Buffer.from(JSON.stringify(el)));
}

function applyItemMap(raw: Buffer, itemMap: Record<string, string> = {}) {
  if (!itemMap || !Object.keys(itemMap).length) return raw;
  const obj = JSON.parse(Buffer.from(raw).toString('utf8'));
  const out = { ...obj };
  for (const [dpKey, idxKey] of Object.entries(itemMap)) {
    if (idxKey in obj) {
      out[dpKey] = obj[idxKey];
      if (idxKey !== dpKey) delete out[idxKey];
    }
  }
  return Buffer.from(JSON.stringify(out));
}

function playlistItemsFromDynamicQueryBody(body: Buffer, dq: DynamicQueryLike) {
  const profile = dq?.Profile || dq?.profile;
  if (profile !== ProfileHTTPSJSONV1 && profile !== ProfileGraphQLV1)
    throw new Error(`${ErrDynamicQueryUnknownProfile.message}: "${profile}"`);
  const rm = dq?.ResponseMapping || dq?.responseMapping;
  if (!rm) throw new Error(`${ErrDynamicQueryRequest.message}: missing responseMapping`);
  const rawItems = extractDynamicItems(body, profile, rm);
  const out = [];
  for (const raw of rawItems) {
    const itemJSON = applyItemMap(raw, rm.ItemMap || rm.itemMap || {});
    try {
      parsePlaylistItem(itemJSON);
      out.push(JSON.parse(Buffer.from(itemJSON).toString('utf8')));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${ErrDynamicQueryItemInvalid.message}: ${message}`);
    }
  }
  return out;
}

export async function PlaylistItemsFromDynamicQuery(
  ctx: unknown,
  dq: DynamicQueryLike,
  params: Record<string, string> | undefined,
  client: { fetch?: typeof fetch } | undefined,
  opts: { AllowInsecureHTTP?: boolean } | null | undefined
) {
  if (!dq) throw new Error(`${ErrDynamicQueryRequest.message}: nil dynamicQuery`);
  const body = await fetchDynamicQueryResponseBody(ctx, dq, params, client, opts);
  return playlistItemsFromDynamicQueryBody(body, dq);
}

export async function clonePlaylistWithDynamicQuery(
  p: PlaylistLike,
  params: Record<string, string> | undefined,
  client: { fetch?: typeof fetch } | undefined,
  opts: { AllowInsecureHTTP?: boolean } | null | undefined
) {
  return clonePlaylistWithDynamicQueryCtx(p, undefined, params, client, opts);
}

async function clonePlaylistWithDynamicQueryCtx(
  p: PlaylistLike,
  ctx: unknown,
  params: Record<string, string> | undefined,
  client: { fetch?: typeof fetch } | undefined,
  opts: { AllowInsecureHTTP?: boolean } | null | undefined
) {
  if (!p) throw new Error(`${ErrDynamicQueryRequest.message}: nil playlist`);
  const out = clonePlaylist(p) as {
    items?: unknown[];
    Items?: unknown[];
  } & Record<string, unknown>;
  if (!p?.DynamicQuery && !p?.dynamicQuery) return out;
  const dq = (p.DynamicQuery || p.dynamicQuery) as DynamicQueryLike;
  const items = await PlaylistItemsFromDynamicQuery(ctx, dq, params, client, opts);
  const staticItems = Array.isArray((out as { Items?: unknown[] }).Items)
    ? ((out as { Items?: unknown[] }).Items as unknown[])
    : Array.isArray((out as { items?: unknown[] }).items)
      ? ((out as { items?: unknown[] }).items as unknown[])
      : [];
  (out as { items?: unknown[] }).items = [...staticItems, ...items];
  if ('Items' in out) delete (out as { Items?: unknown }).Items;
  return out;
}

export async function ResolveDynamicQuery(
  p: PlaylistLike,
  ctx: unknown,
  params: Record<string, string> | undefined,
  client: { fetch?: typeof fetch } | undefined,
  opts: { AllowInsecureHTTP?: boolean } | null | undefined
) {
  return clonePlaylistWithDynamicQueryCtx(p, ctx, params, client, opts);
}
