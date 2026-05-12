import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as nodeSign,
  verify as nodeVerify,
} from 'node:crypto';
import { transform } from '../jcs/index.js';

function stripSignatureFields(raw: Buffer | string) {
  const obj = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  delete obj.signature;
  delete obj.signatures;
  return JSON.stringify(obj);
}

export function canonicalPayload(raw: Buffer | string) {
  return transform(stripSignatureFields(raw));
}

export function signingMessage(raw: Buffer | string) {
  const canon = canonicalPayload(raw);
  return Buffer.concat([canon, Buffer.from('\n')]);
}

export function signingDigest(raw: Buffer | string) {
  return createHash('sha256').update(signingMessage(raw)).digest();
}

export function payloadHashString(raw: Buffer | string) {
  return `sha256:${signingDigest(raw).toString('hex')}`;
}

export function verifyPayloadHash(raw: Buffer | string, wantHash: string) {
  const got = payloadHashString(raw);
  if (got !== wantHash) throw new Error('payload_hash does not match canonical document digest');
}

export function signEd25519(raw: Buffer | string, privateKey: Parameters<typeof nodeSign>[2]) {
  return nodeSign(null, signingDigest(raw), privateKey);
}

export function verifyEd25519(
  raw: Buffer | string,
  sig: Buffer,
  publicKey: Parameters<typeof nodeVerify>[2]
) {
  return nodeVerify(null, signingDigest(raw), publicKey, sig);
}

export function loadPrivateKey(key: Parameters<typeof createPrivateKey>[0]) {
  return createPrivateKey(key);
}

export function loadPublicKey(key: Parameters<typeof createPublicKey>[0]) {
  return createPublicKey(key);
}
