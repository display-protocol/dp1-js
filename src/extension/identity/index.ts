export function parseEntity(doc: unknown) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new Error('dp1: entity must be an object');
  return doc;
}

export class EntityDocument {
  constructor(data: Record<string, unknown> = {}) {
    Object.assign(this, structuredClone(data));
  }
}
