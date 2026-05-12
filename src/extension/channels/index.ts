export function parseChannel(doc: unknown) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new Error('dp1: channel must be an object');
  return doc;
}
