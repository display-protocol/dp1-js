import type { Playlist, PlaylistItem } from '../types.js';

/** Accepts Z, +07:00, and compact +0700 absolute offsets. */
const DISPLAY_AT_TIMEZONE_RE = /(?:Z|[+-]\d{2}:?\d{2}(?::\d{2})?)$/i;
const DISPLAY_AT_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_AT_LOCAL_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;

function invalidDisplayAt(displayAt: string): never {
  throw new Error(`dp1: invalid displayAt "${displayAt}"`);
}

function resolvedLocalTimezone(localTimezone?: string): string {
  return localTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function readTimeZoneOffsetMs(instant: Date, timeZone: string): number {
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
  const parts = formatter.formatToParts(instant);
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
  return asUtc - instant.getTime();
}

function wallTimeInZoneToDate(localDateTime: string, timeZone: string): Date {
  const match = DISPLAY_AT_LOCAL_RE.exec(localDateTime);
  if (!match) invalidDisplayAt(localDateTime);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? '0');
  const minute = Number(match[5] ?? '0');
  const second = Number(match[6] ?? '0');
  const millisecond = Number((match[7] ?? '0').padEnd(3, '0'));

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  for (let i = 0; i < 3; i++) {
    const offsetMs = readTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const corrected = Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - offsetMs;
    if (corrected === utcMs) break;
    utcMs = corrected;
  }
  return new Date(utcMs);
}

/**
 * Parse a playlist item `displayAt` string.
 * With Z/offset → absolute instant. Without timezone → wall time in `localTimezone`
 * (or the device timezone). Date-only values are treated as local midnight.
 * Throws on empty or malformed input.
 */
export function parseDisplayAt(displayAt: string, localTimezone?: string): Date {
  const trimmed = displayAt.trim();
  if (!trimmed) throw new Error('dp1: displayAt must be a non-empty string');

  if (DISPLAY_AT_TIMEZONE_RE.test(trimmed)) {
    // Normalize compact offsets (+0700) to colon form for ECMAScript Date parsing.
    const normalized = trimmed.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) invalidDisplayAt(displayAt);
    return parsed;
  }

  const localDateTime = DISPLAY_AT_DATE_ONLY_RE.test(trimmed) ? `${trimmed}T00:00:00` : trimmed;
  const timeZone = resolvedLocalTimezone(localTimezone);
  return wallTimeInZoneToDate(localDateTime, timeZone);
}

function itemDisplayAtMs(item: PlaylistItem, localTimezone?: string): number | null {
  if (typeof item.displayAt !== 'string') return null;
  return parseDisplayAt(item.displayAt, localTimezone).getTime();
}

/**
 * When `schedule.byDisplayAt` is true, return the active playback set:
 * items at max(displayAt <= now), plus items without `displayAt`, in original order.
 * Otherwise return a shallow copy of all items.
 * Throws if any item has a malformed `displayAt`.
 */
export function computeActiveSet(
  playlist: Playlist,
  now: Date,
  localTimezone?: string
): PlaylistItem[] {
  if (playlist.schedule?.byDisplayAt !== true) return [...playlist.items];

  const nowMs = now.getTime();
  const displayAtByIndex = playlist.items.map(item => itemDisplayAtMs(item, localTimezone));
  let maxPassedMs: number | null = null;

  for (const displayAtMs of displayAtByIndex) {
    if (displayAtMs === null || displayAtMs > nowMs) continue;
    if (maxPassedMs === null || displayAtMs > maxPassedMs) maxPassedMs = displayAtMs;
  }

  return playlist.items.filter((_, index) => {
    const displayAtMs = displayAtByIndex[index];
    if (displayAtMs === null) return true;
    return maxPassedMs !== null && displayAtMs === maxPassedMs;
  });
}

/**
 * Smallest future `displayAt` after `now`, independent of `schedule.byDisplayAt`.
 * Returns null when none remain. Throws on malformed `displayAt` values.
 */
export function nextDisplayAt(
  playlist: Playlist,
  now: Date,
  localTimezone?: string
): Date | null {
  const nowMs = now.getTime();
  let nextMs: number | null = null;

  for (const item of playlist.items) {
    const displayAtMs = itemDisplayAtMs(item, localTimezone);
    if (displayAtMs === null || displayAtMs <= nowMs) continue;
    if (nextMs === null || displayAtMs < nextMs) nextMs = displayAtMs;
  }

  return nextMs === null ? null : new Date(nextMs);
}
