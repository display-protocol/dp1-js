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

function parseFractionalMs(frac: string | undefined): number {
  if (!frac) return 0;
  return Number(frac.slice(0, 3).padEnd(3, '0'));
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
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
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
    year: read('year'),
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
  millisecond: number,
  timeZone: string
): Date {
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
    return new Date(Math.min(...matches) + millisecond);
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
  return new Date(snapped);
}

/**
 * Parse a playlist item `displayAt` string per Playlist Extension §3.5.2.
 * With Z/colon-offset → absolute instant. Without timezone → display-locale wall time
 * (`localTimezone` or the device timezone). Date-only and compact offsets (`+0700`) are rejected.
 * Throws on empty or malformed input.
 */
export function parseDisplayAt(displayAt: string, localTimezone?: string): Date {
  if (!displayAt) throw new Error('dp1: displayAt must be a non-empty string');

  const absolute = DISPLAY_AT_ABSOLUTE_WIRE_RE.exec(displayAt);
  if (absolute) {
    const year = Number(absolute[1]);
    const month = Number(absolute[2]);
    const day = Number(absolute[3]);
    if (!isValidCalendarDate(year, month, day)) invalidDisplayAt(displayAt);
    const parsed = new Date(displayAt);
    if (Number.isNaN(parsed.getTime())) invalidDisplayAt(displayAt);
    return parsed;
  }

  const local = DISPLAY_AT_LOCAL_WIRE_RE.exec(displayAt);
  if (!local) invalidDisplayAt(displayAt);

  const year = Number(local[1]);
  const month = Number(local[2]);
  const day = Number(local[3]);
  const hour = Number(local[4]);
  const minute = Number(local[5]);
  const second = Number(local[6]);
  const millisecond = parseFractionalMs(local[7]);
  if (!isValidCalendarDate(year, month, day)) invalidDisplayAt(displayAt);

  try {
    return wallTimeInZoneToDate(
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
      resolvedLocalTimezone(localTimezone)
    );
  } catch (err: unknown) {
    if (err instanceof RangeError) invalidDisplayAt(displayAt);
    throw err;
  }
}

/**
 * Resolve item displayAt for eligibility.
 * - missing → evergreen (`none`)
 * - valid → `instant`
 * - invalid / unresolvable → `invalid` (not eligible, not a timer candidate)
 */
type ItemDisplayAt =
  | { kind: 'none' }
  | { kind: 'instant'; ms: number }
  | { kind: 'invalid' };

function resolveItemDisplayAt(item: PlaylistItem, localTimezone?: string): ItemDisplayAt {
  if (typeof item.displayAt !== 'string') return { kind: 'none' };
  try {
    return { kind: 'instant', ms: parseDisplayAt(item.displayAt, localTimezone).getTime() };
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
  now: Date,
  localTimezone?: string
): PlaylistItem[] {
  if (!playlist.items.some(item => Object.hasOwn(item, 'displayAt'))) return [...playlist.items];

  const nowMs = now.getTime();
  const resolved = playlist.items.map(item => resolveItemDisplayAt(item, localTimezone));
  let maxPassedMs: number | null = null;

  for (const entry of resolved) {
    if (entry.kind !== 'instant' || entry.ms > nowMs) continue;
    if (maxPassedMs === null || entry.ms > maxPassedMs) maxPassedMs = entry.ms;
  }

  return playlist.items.filter((_, index) => {
    const entry = resolved[index];
    if (entry.kind === 'none') return true;
    if (entry.kind === 'invalid') return false;
    return maxPassedMs !== null && entry.ms === maxPassedMs;
  });
}

/**
 * Smallest future resolvable `displayAt` after `now` (§3.5.4).
 * Unresolvable wire forms are ignored. Returns null when none remain.
 */
export function nextDisplayAt(
  playlist: Playlist,
  now: Date,
  localTimezone?: string
): Date | null {
  const nowMs = now.getTime();
  let nextMs: number | null = null;

  for (const item of playlist.items) {
    const entry = resolveItemDisplayAt(item, localTimezone);
    if (entry.kind !== 'instant' || entry.ms <= nowMs) continue;
    if (nextMs === null || entry.ms < nextMs) nextMs = entry.ms;
  }

  return nextMs === null ? null : new Date(nextMs);
}
