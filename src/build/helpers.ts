import { randomUUID } from 'node:crypto';
import type { DisplayScaling, Margin } from './types.js';

export type Builder<T> = { build(): T };

export function resolve<T>(value: T | Builder<T>): T {
  if (value && typeof value === 'object' && 'build' in value && typeof value.build === 'function') {
    return (value as Builder<T>).build();
  }
  return value as T;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function generateId(): string {
  return randomUUID();
}

export function assertKebabSlug(slug: string, fieldName = 'slug'): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`dp1: ${fieldName} must be kebab-case`);
  }
}

export function slugify(input: string): string {
  const raw = String(input ?? '')
    .trim()
    .toLowerCase();
  const slug = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  if (!slug) throw new Error('dp1: slugify produced an empty slug');
  assertKebabSlug(slug);
  return slug;
}

export function assertUri(value: string, fieldName = 'uri'): void {
  const s = String(value ?? '');
  if (!s) throw new Error(`dp1: ${fieldName} must be a uri`);
  try {
    // Accept any absolute URI scheme supported by WHATWG URL, including ipfs:// and ar://.
    // This intentionally does not enforce https-only policies.
    new URL(s);
  } catch {
    throw new Error(`dp1: ${fieldName} must be a uri`);
  }
}

export function assertHexColor(value: string, fieldName = 'background'): void {
  const s = String(value ?? '');
  if (s === 'transparent') return;
  // Schema allows mixed-case hex for display backgrounds.
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`dp1: ${fieldName} must be '#RRGGBB' or 'transparent'`);
  }
}

/** Schema uses lowercase-only hex digests (`^[a-f0-9]{64}$`). */
export function assertHex64(value: string, fieldName: string): string {
  const s = String(value ?? '');
  if (!/^[a-f0-9]{64}$/.test(s)) {
    throw new Error(`dp1: ${fieldName} must be 64 lowercase hex chars`);
  }
  return s;
}

/** Schema uses lowercase-only `0x` hex (`^0x[a-f0-9]+$`). */
export function assert0xHex(value: string, fieldName: string): string {
  const s = String(value ?? '');
  if (!/^0x[a-f0-9]+$/.test(s)) {
    throw new Error(`dp1: ${fieldName} must be 0x-prefixed lowercase hex`);
  }
  return s;
}

export function assertMargin(value: Margin, fieldName: string): void {
  if (typeof value === 'number') {
    if (!(value >= 0)) throw new Error(`dp1: ${fieldName} must be >= 0`);
    return;
  }
  if (typeof value === 'string' && /^\d+(\.\d+)?(px|%|vw|vh)$/.test(value)) return;
  throw new Error(`dp1: ${fieldName} must be a number (px) or a string with px|%|vw|vh`);
}

export function assertScaling(value: string, fieldName: string): asserts value is DisplayScaling {
  if (!['fit', 'fill', 'stretch', 'auto'].includes(value)) {
    throw new Error(`dp1: ${fieldName} must be one of fit|fill|stretch|auto`);
  }
}

export function assertSemver(value: string, fieldName: string): void {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`dp1: ${fieldName} must be semver (e.g. 1.1.0)`);
  }
}
