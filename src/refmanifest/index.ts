export function parseRefManifest(doc: unknown) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new Error('dp1: ref manifest must be an object');
  const obj = doc as Record<string, unknown>;
  if (
    typeof obj.refVersion !== 'string' ||
    typeof obj.id !== 'string' ||
    typeof obj.created !== 'string' ||
    typeof obj.locale !== 'string'
  ) {
    throw new Error('dp1: invalid ref manifest');
  }
  return doc;
}

export class RefManifestDocument {
  constructor(data: Record<string, unknown> = {}) {
    Object.assign(this, structuredClone(data));
  }
}
