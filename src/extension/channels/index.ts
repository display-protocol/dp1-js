import { ChannelsExtension } from '../../validate/index.js';
import type { RequireSignaturesOptions } from '../../validate/index.js';

/**
 * Validate an already-parsed channel against the published channels-extension schema and
 * return it. Signatures are required unless `{ requireSignatures: false }`.
 */
export function parseChannel(doc: unknown, options?: RequireSignaturesOptions) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new Error('dp1: channel must be an object');
  ChannelsExtension(doc, options);
  return doc;
}
