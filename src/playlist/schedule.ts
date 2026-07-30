import type { Playlist, PlaylistItem } from '../types.js';

/** §3.5.2 local: YYYY-MM-DDThh:mm:ss[.frac] (seconds required, no timezone). */
const DISPLAY_AT_LOCAL_WIRE_RE =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d+))?$/;

/** §3.5.2 absolute: RFC 3339 date-time with Z or colon offset (±HH:MM). */
const DISPLAY_AT_ABSOLUTE_WIRE_RE =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d+))?(Z|[+-]([01]\d|2[0-3]):([0-5]\d))$/;

function invalidDisplayAt(displayAt: string): never {
  throw new Error(`dp1: invalid displayAt "${displayAt}"`);
}

function resolvedLocalTimezone(localTimezone?: string): string {
  return localTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const NANOSECONDS_PER_MILLISECOND = 1_000_000n;

function parseFractionalNanoseconds(frac: string | undefined): bigint {
  if (!frac) return 0n;
  // DP-1 and dp1-go resolve fractions at nanosecond precision.
  return BigInt(frac.slice(0, 9).padEnd(9, '0'));
}

function dateToNanoseconds(date: Date): bigint {
  return BigInt(date.getTime()) * NANOSECONDS_PER_MILLISECOND;
}

function nanosecondsToDate(nanoseconds: bigint, roundUp: boolean): Date {
  let milliseconds = nanoseconds / NANOSECONDS_PER_MILLISECOND;
  const remainder = nanoseconds % NANOSECONDS_PER_MILLISECOND;
  if (remainder !== 0n) {
    // BigInt division truncates toward zero. Parse compatibility requires floor,
    // while timer results require ceil so they never fire before a release.
    if (roundUp && nanoseconds > 0n) milliseconds += 1n;
    if (!roundUp && nanoseconds < 0n) milliseconds -= 1n;
  }
  return new Date(Number(milliseconds));
}

function utcTimeMs(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): number {
  // Date.UTC remaps 0000–0099 to 1900–1999; setUTCFullYear preserves the wire year.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  return date.getTime();
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const probe = new Date(utcTimeMs(year, month, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function readTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  // Intl formatToParts is second-precision; floor so offset is not skewed by milliseconds.
  const floored = new Date(Math.floor(instant.getTime() / 1000) * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    era: 'short',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(floored);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value);
  // Intl renders astronomical year 0 as 1 BC. Reconstruct the wire year before
  // building a UTC timestamp, and use utcTimeMs so 0000–0099 are not remapped.
  const year =
    parts.find(part => part.type === 'era')?.value === 'BC' ? 1 - read('year') : read('year');
  const asUtc = utcTimeMs(
    year,
    read('month'),
    read('day'),
    read('hour'),
    read('minute'),
    read('second')
  );
  return asUtc - floored.getTime();
}

type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallPartsInZone(instant: Date, timeZone: string): WallParts {
  const floored = new Date(Math.floor(instant.getTime() / 1000) * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    era: 'short',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(floored);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value);
  return {
    year: parts.find(part => part.type === 'era')?.value === 'BC' ? 1 - read('year') : read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function sameWall(a: WallParts, b: WallParts): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

function wallCompare(a: WallParts, b: WallParts): number {
  return (
    a.year - b.year ||
    a.month - b.month ||
    a.day - b.day ||
    a.hour - b.hour ||
    a.minute - b.minute ||
    a.second - b.second
  );
}

/**
 * Resolve bare local wall time in `timeZone`.
 * Fold (ambiguous): earlier instant. Gap (nonexistent): first valid local instant after the gap.
 */
function wallTimeInZoneToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  fractionNanoseconds: bigint,
  timeZone: string
): { date: Date; preservesFraction: boolean } {
  const millisecond = Number(fractionNanoseconds / NANOSECONDS_PER_MILLISECOND);
  const desired: WallParts = { year, month, day, hour, minute, second };
  const guess = utcTimeMs(year, month, day, hour, minute, second);
  const matches: number[] = [];

  // Probe nearby UTC guesses so both fold sides can be discovered.
  for (const hourDelta of [-36, -25, -24, -14, -13, -12, -2, -1, 0, 1, 2, 12, 13, 14, 24, 25, 36]) {
    const probe = guess + hourDelta * 3_600_000;
    const offsetMs = readTimeZoneOffsetMs(new Date(probe), timeZone);
    const utcMs = utcTimeMs(year, month, day, hour, minute, second) - offsetMs;
    if (sameWall(wallPartsInZone(new Date(utcMs), timeZone), desired)) {
      matches.push(utcMs);
    }
  }

  if (matches.length > 0) {
    // Fold: earlier of the ambiguous instants. Unique match: that instant.
    return { date: new Date(Math.min(...matches) + millisecond), preservesFraction: true };
  }

  // Gap: seek the first local instant after the nonexistent wall time.
  let lo = guess - 48 * 3_600_000;
  let hi = guess + 48 * 3_600_000;
  let found: number | null = null;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const wall = wallPartsInZone(new Date(mid), timeZone);
    if (wallCompare(wall, desired) >= 0) {
      found = mid;
      hi = mid - 1000;
    } else {
      lo = mid + 1000;
    }
  }
  if (found === null) invalidDisplayAt(`${year}-${month}-${day}T${hour}:${minute}:${second}`);

  // Snap to the first local instant after the gap. The requested fractional part does not
  // survive: this is the transition boundary, matching dp1-go's firstInstantAfterGap.
  const snapped = Math.floor(found / 1000) * 1000;
  return { date: new Date(snapped), preservesFraction: false };
}

/**
 * Parse a playlist item `displayAt` into epoch nanoseconds per Playlist Extension §3.5.2.
 * Fractions are resolved to nanoseconds, matching dp1-go; extra digits are truncated.
 */
export function parseDisplayAtNanoseconds(displayAt: string, localTimezone?: string): bigint {
  if (!displayAt) throw new Error('dp1: displayAt must be a non-empty string');

  const absolute = DISPLAY_AT_ABSOLUTE_WIRE_RE.exec(displayAt);
  if (absolute) {
    const year = Number(absolute[1]);
    const month = Number(absolute[2]);
    const day = Number(absolute[3]);
    const hour = Number(absolute[4]);
    const minute = Number(absolute[5]);
    const second = Number(absolute[6]);
    if (!isValidCalendarDate(year, month, day)) invalidDisplayAt(displayAt);

    const timezone = absolute[8];
    let offsetMs = 0;
    if (timezone !== 'Z') {
      const sign = timezone.startsWith('+') ? 1 : -1;
      const offsetHours = Number(timezone.slice(1, 3));
      const offsetMinutes = Number(timezone.slice(4, 6));
      offsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60_000;
    }
    return (
      BigInt(utcTimeMs(year, month, day, hour, minute, second) - offsetMs) *
        NANOSECONDS_PER_MILLISECOND +
      parseFractionalNanoseconds(absolute[7])
    );
  }

  const local = DISPLAY_AT_LOCAL_WIRE_RE.exec(displayAt);
  if (!local) invalidDisplayAt(displayAt);

  const year = Number(local[1]);
  const month = Number(local[2]);
  const day = Number(local[3]);
  const hour = Number(local[4]);
  const minute = Number(local[5]);
  const second = Number(local[6]);
  const fractionNanoseconds = parseFractionalNanoseconds(local[7]);
  if (!isValidCalendarDate(year, month, day)) invalidDisplayAt(displayAt);

  try {
    const resolved = wallTimeInZoneToDate(
      year,
      month,
      day,
      hour,
      minute,
      second,
      fractionNanoseconds,
      resolvedLocalTimezone(localTimezone)
    );
    return (
      dateToNanoseconds(resolved.date) +
      (resolved.preservesFraction ? fractionNanoseconds % NANOSECONDS_PER_MILLISECOND : 0n)
    );
  } catch (err: unknown) {
    if (err instanceof RangeError) invalidDisplayAt(displayAt);
    throw err;
  }
}

/**
 * Parse a playlist item `displayAt` string per Playlist Extension §3.5.2.
 * With Z/colon-offset → absolute instant. Without timezone → display-locale wall time
 * (`localTimezone` or the device timezone). Date-only and compact offsets (`+0700`) are rejected.
 * Throws on empty or malformed input.
 */
export function parseDisplayAt(displayAt: string, localTimezone?: string): Date {
  return nanosecondsToDate(parseDisplayAtNanoseconds(displayAt, localTimezone), false);
}

/**
 * Resolve item displayAt for eligibility.
 * - missing → evergreen (`none`)
 * - valid → `instant`
 * - invalid / unresolvable → `invalid` (not eligible, not a timer candidate)
 */
type ItemDisplayAt =
  | { kind: 'none' }
  | { kind: 'instant'; nanoseconds: bigint }
  | { kind: 'invalid' };

function resolveItemDisplayAt(item: PlaylistItem, localTimezone?: string): ItemDisplayAt {
  if (!Object.hasOwn(item, 'displayAt')) return { kind: 'none' };
  if (typeof item.displayAt !== 'string') return { kind: 'invalid' };
  try {
    return {
      kind: 'instant',
      nanoseconds: parseDisplayAtNanoseconds(item.displayAt, localTimezone),
    };
  } catch {
    return { kind: 'invalid' };
  }
}

/**
 * When at least one item has `displayAt`, return the eligible playback set (§3.5.1 / §3.5.3):
 * items at max(displayAt ≤ now), plus items without `displayAt`, in original order.
 * Malformed `displayAt` values are skipped (not eligible, not evergreen).
 * When no item has `displayAt`, return a shallow copy of all items.
 */
export function computeActiveSet(
  playlist: Playlist,
  now: Date | bigint,
  localTimezone?: string
): PlaylistItem[] {
  if (!playlist.items.some(item => Object.hasOwn(item, 'displayAt'))) return [...playlist.items];

  const nowNanoseconds = typeof now === 'bigint' ? now : dateToNanoseconds(now);
  const resolved = playlist.items.map(item => resolveItemDisplayAt(item, localTimezone));
  let maxPassedNanoseconds: bigint | null = null;

  for (const entry of resolved) {
    if (entry.kind !== 'instant' || entry.nanoseconds > nowNanoseconds) continue;
    if (maxPassedNanoseconds === null || entry.nanoseconds > maxPassedNanoseconds) {
      maxPassedNanoseconds = entry.nanoseconds;
    }
  }

  return playlist.items.filter((_, index) => {
    const entry = resolved[index];
    if (entry.kind === 'none') return true;
    if (entry.kind === 'invalid') return false;
    return maxPassedNanoseconds !== null && entry.nanoseconds === maxPassedNanoseconds;
  });
}

/**
 * Smallest future resolvable `displayAt` after `now` (§3.5.4).
 * Unresolvable wire forms are ignored. Returns null when none remain.
 */
export function nextDisplayAt(playlist: Playlist, now: Date, localTimezone?: string): Date | null;
export function nextDisplayAt(
  playlist: Playlist,
  now: bigint,
  localTimezone?: string
): bigint | null;
export function nextDisplayAt(
  playlist: Playlist,
  now: Date | bigint,
  localTimezone?: string
): Date | bigint | null {
  const nowNanoseconds = typeof now === 'bigint' ? now : dateToNanoseconds(now);
  let nextNanoseconds: bigint | null = null;

  for (const item of playlist.items) {
    const entry = resolveItemDisplayAt(item, localTimezone);
    if (entry.kind !== 'instant' || entry.nanoseconds <= nowNanoseconds) continue;
    if (nextNanoseconds === null || entry.nanoseconds < nextNanoseconds) {
      nextNanoseconds = entry.nanoseconds;
    }
  }

  if (nextNanoseconds === null) return null;
  return typeof now === 'bigint' ? nextNanoseconds : nanosecondsToDate(nextNanoseconds, true);
}
