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

/**
 * A v4 UUID from the Web Crypto global, which Node 19+, every modern browser, and Cloudflare
 * Workers all provide. (Browsers expose `randomUUID` only in secure contexts.)
 */
export function generateId(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID !== 'function') {
    throw new Error('dp1: crypto.randomUUID() is unavailable in this runtime');
  }
  return webCrypto.randomUUID();
}

/** Produce a kebab-case slug from free text (generator helper, not schema validation). */
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
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('dp1: slugify produced an invalid kebab-case slug');
  }
  return slug;
}
