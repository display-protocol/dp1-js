import { RefManifest } from '../validate/index.js';

/**
 * Validate an already-parsed ref manifest against the published schema and return it.
 * Throws a validation error (with `details`) for any document the schema rejects.
 */
export function parseRefManifest(doc: unknown) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new Error('dp1: ref manifest must be an object');
  RefManifest(doc);
  return doc;
}

export class RefManifestDocument {
  constructor(data: Record<string, unknown> = {}) {
    Object.assign(this, structuredClone(data));
  }
}
