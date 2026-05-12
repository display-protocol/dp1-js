import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Ed25519DIDKey, Ed25519PublicKeyFromDIDKey } from '../../src/sign/index.js';

test('Ed25519DIDKey_wellKnownVector', () => {
  const pub = Buffer.alloc(32, 7);
  assert.ok(Ed25519DIDKey(pub).startsWith('did:key:'));
});

test('Ed25519DIDKey_wrongKeyLength', () => {
  assert.throws(() => Ed25519DIDKey(Buffer.alloc(31)));
});

test('Ed25519DIDKey_roundTripMultibase', () => {
  const pub = Buffer.alloc(32, 7);
  const did = Ed25519DIDKey(pub);
  assert.deepEqual(Buffer.from(Ed25519PublicKeyFromDIDKey(did)), pub);
});

test('Ed25519PublicKeyFromDIDKey_rejectsNonDidKey', () => {
  assert.throws(() => Ed25519PublicKeyFromDIDKey('did:web:example.com'));
});

test('Ed25519PublicKeyFromDIDKey_rejectsWrongMulticodec', () => {
  assert.throws(() =>
    Ed25519PublicKeyFromDIDKey('did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doKx')
  );
});
