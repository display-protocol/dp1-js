import { randomUUID } from 'node:crypto';

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
  const raw = String(input ?? '').trim().toLowerCase();
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
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`dp1: ${fieldName} must be '#RRGGBB' or 'transparent'`);
  }
}

