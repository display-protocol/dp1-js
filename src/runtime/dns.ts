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

/** Options passed to a resolver, matching the `dns.lookup` signature. */
export type LookupOptions = { all: true };

/**
 * Resolve a hostname to the addresses it answers with.
 *
 * Deliberately shaped so `dns.promises.lookup` can be injected *directly* — that is the whole
 * point of documenting the seam as "shaped like `dns.lookup`". The options argument is passed
 * on every call, and a resolver may answer with either an array or the single-address object
 * `dns.lookup` returns when `all` is not honoured. A simpler `host => Promise<Address[]>`
 * function is still assignable, since JavaScript lets a callback ignore trailing arguments.
 */
export type HostResolver = (
  host: string,
  options: LookupOptions
) => Promise<ResolvedAddress[] | ResolvedAddress>;

type NodeDns = { lookup?: HostResolver };
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

  return (host, options) => lookup.call(dns, host, options);
}

/**
 * Call a resolver and normalize its answer to a list.
 *
 * Centralizes the two shapes `dns.lookup` can return so no call site has to know: an array
 * when `{ all: true }` is honoured, or a bare `{ address, family }` when it is not. Treating
 * the single-object form as "no addresses" would have failed every hostname open — it is a
 * security check, so an unrecognized answer must be an error, never an empty pass.
 */
export async function resolveAddresses(
  resolve: HostResolver,
  host: string
): Promise<ResolvedAddress[]> {
  const answer = await resolve(host, { all: true });
  if (Array.isArray(answer)) return answer;
  if (answer && typeof answer === 'object' && typeof answer.address === 'string') return [answer];
  throw new TypeError(
    'resolver returned neither an address list nor an { address, family } object'
  );
}

/** Test seam: forget the probe result so the next call re-detects. */
export function resetPlatformResolver() {
  cached = undefined;
}
