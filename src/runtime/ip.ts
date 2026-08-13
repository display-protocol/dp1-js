/**
 * `net.isIP` without `node:net`.
 *
 * The original is a pure predicate over a string, so there is nothing platform-specific to
 * keep — reimplementing it removes a Node import at no cost. `tests/runtime/ip.test.ts`
 * differential-tests this against `node:net` so the two cannot drift.
 */

/** Matches `net.isIPv4`: exactly four decimal octets, no leading zeros, no spaces. */
export function isIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    // `010` is rejected rather than read as octal, as inet_pton does.
    if (part.length > 1 && part[0] === '0') return false;
    if (Number(part) > 255) return false;
  }
  return true;
}

/**
 * Matches `net.isIPv6`: RFC 4291 text form, including `::`, a trailing IPv4 tail, and an
 * RFC 4007 zone id.
 *
 * The zone id matters for the SSRF guard: `net.isIP('fe80::1%eth0')` is 6, so the caller
 * range-checks a link-local literal instead of handing it to a DNS resolver that would never
 * have resolved it. Rejecting the zone here would let that address slip past on any runtime
 * with no resolver available.
 */
export function isIPv6(value: string): boolean {
  let address = value;
  if (address.includes('%')) {
    const [head, zone, ...rest] = address.split('%');
    // Exactly one `%`, then a non-empty zone over the charset `net.isIPv6` accepts.
    if (rest.length || !/^[-.:0-9A-Za-z]+$/.test(zone ?? '')) return false;
    address = head;
  }
  if (address.includes('[') || address.includes(']')) return false;

  const halves = address.split('::');
  if (halves.length > 2) return false;

  const groups = (half: string) => (half === '' ? [] : half.split(':'));
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  if (halves.length === 1 && head.length === 0) return false;

  // A trailing dotted-quad stands in for the last two groups.
  const last = (tail.length ? tail : head).at(-1);
  let ipv4Tail = 0;
  if (last !== undefined && last.includes('.')) {
    if (!isIPv4(last)) return false;
    if (tail.length) tail.pop();
    else head.pop();
    ipv4Tail = 2;
  }

  for (const group of [...head, ...tail]) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return false;
  }

  const total = head.length + tail.length + ipv4Tail;
  // Without `::` the address must be exactly 8 groups; with it, `::` must cover at least one.
  return halves.length === 2 ? total <= 7 : total === 8;
}

/** Matches `net.isIP`: 4, 6, or 0 when the string is neither. */
export function isIP(value: string): 0 | 4 | 6 {
  if (isIPv4(value)) return 4;
  if (isIPv6(value)) return 6;
  return 0;
}
