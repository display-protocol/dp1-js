/**
 * Hostname resolution for the dynamic-query SSRF guard, where one is available.
 *
 * `dns.lookup` has no browser or Cloudflare Workers equivalent: neither runtime can resolve a
 * hostname to an address before fetching it. So the resolver is a seam rather than an import
 * — callers may inject one, and on Node the platform's own is found automatically.
 *
 * `process.getBuiltinModule` is what makes the automatic path possible without breaking the
 * other two targets. It is a *function call taking a string*, not an import specifier, so no
 * bundler resolves it, nothing pulls a `node:dns` polyfill into a browser bundle, and a
 * Worker built without `nodejs_compat` still links. It exists from Node 22.3; older Node and
 * every non-Node runtime simply report no resolver, and the caller degrades as documented in
 * `src/playlist/index.ts`.
 */

/** One resolved address, shaped like a `dns.lookup(host, { all: true })` entry. */
export type ResolvedAddress = { address: string; family: number };

/** Resolve a hostname to every address it answers with. */
export type HostResolver = (host: string) => Promise<ResolvedAddress[]>;

type NodeDns = { lookup?: (host: string, options: { all: true }) => Promise<ResolvedAddress[]> };
type GetBuiltinModule = ((id: string) => unknown) | undefined;

let cached: HostResolver | null | undefined;

/**
 * The platform resolver, or null where the runtime has none.
 *
 * Cached after the first call, including the negative answer, so a browser or Worker pays the
 * feature probe once.
 */
export function platformResolver(): HostResolver | null {
  if (cached !== undefined) return cached;
  cached = detect();
  return cached;
}

function detect(): HostResolver | null {
  const getBuiltinModule = (globalThis as { process?: { getBuiltinModule?: GetBuiltinModule } })
    .process?.getBuiltinModule;
  if (typeof getBuiltinModule !== 'function') return null;

  let dns: NodeDns | undefined;
  try {
    dns = getBuiltinModule('node:dns/promises') as NodeDns | undefined;
  } catch {
    // workerd exposes `getBuiltinModule` under `nodejs_compat` but throws for modules it does
    // not implement. No resolver, same as a browser.
    return null;
  }
  const lookup = dns?.lookup;
  if (typeof lookup !== 'function') return null;

  return (host: string) => lookup.call(dns, host, { all: true });
}

/** Test seam: forget the probe result so the next call re-detects. */
export function resetPlatformResolver() {
  cached = undefined;
}
