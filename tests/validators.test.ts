import { describe, it, expect } from 'vitest';
import {
  validateDpVersion,
  validateDisplayPrefs,
  validateRepro,
  validateProvenance,
  validatePlaylistItem,
} from '../src/validators';

describe('validateDpVersion', () => {
  it('should validate a valid version that meets minimum requirement', () => {
    const result = validateDpVersion('1.0.0');
    expect(result.success).toBe(true);
  });

  it('should validate a version higher than minimum', () => {
    const result = validateDpVersion('2.0.0');
    expect(result.success).toBe(true);
  });

  it('should reject invalid semantic version format', () => {
    const result = validateDpVersion('not-a-version');
    expect(result.success).toBe(false);
    expect((result as { error: { message: string } }).error.message).toBe(
      'Invalid semantic version format: not-a-version'
    );
  });

  it('should reject version below minimum required', () => {
    const result = validateDpVersion('0.9.0');
    expect(result.success).toBe(false);
    expect((result as { error: { message: string } }).error.message).toContain(
      'is below minimum required version'
    );
    expect((result as { error: { message: string } }).error.message).toContain('0.9.0');
  });

  it('should reject empty version string', () => {
    const result = validateDpVersion('');
    expect(result.success).toBe(false);
    expect((result as { error: { message: string } }).error.message).toContain(
      'Invalid semantic version format'
    );
  });

  it('should reject malformed version strings', () => {
    const testCases = ['1.0', '1.0.0-', 'abc.def.ghi', 'not.a.version'];

    testCases.forEach(version => {
      const result = validateDpVersion(version);
      expect(result.success).toBe(false);
      expect((result as { error: { message: string } }).error.message).toContain(
        'Invalid semantic version format'
      );
    });
  });
});

describe('validateDisplayPrefs', () => {
  it('accepts valid display prefs', () => {
    const res = validateDisplayPrefs({ scaling: 'fit', margin: '10%', background: '#000' });
    expect(res.success).toBe(true);
  });

  it('rejects invalid margin string without unit', () => {
    const res = validateDisplayPrefs({ margin: '10' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.length).toBeGreaterThan(0);
      expect(res.error.issues.some(i => i.path === 'margin')).toBe(true);
    }
  });
});

describe('validateRepro', () => {
  it('accepts valid repro', () => {
    const res = validateRepro({
      engineVersion: { chromium: '123.0.0' },
      assetsSHA256: ['0xdeadbeef'],
      frameHash: { sha256: '0xdeadbeef' },
    });
    expect(res.success).toBe(true);
  });

  it('rejects invalid sha256', () => {
    const res = validateRepro({
      engineVersion: { chromium: '123.0.0' },
      assetsSHA256: ['0xdeadbeef'],
      frameHash: { sha256: 'not-hex' },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some(i => i.path.includes('frameHash.sha256'))).toBe(true);
    }
  });
});

describe('validateProvenance', () => {
  it('accepts onChain with address and tokenId', () => {
    const res = validateProvenance({
      type: 'onChain',
      contract: { chain: 'evm', address: '0xabc', tokenId: '42' },
    });
    expect(res.success).toBe(true);
  });

  it('rejects onChain missing contract', () => {
    const res = validateProvenance({ type: 'onChain' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('rejects seriesRegistry missing seriesId', () => {
    const res = validateProvenance({
      type: 'seriesRegistry',
      contract: { chain: 'tezos', address: 'KT1ABC' },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some(i => i.path.endsWith('seriesId'))).toBe(true);
    }
  });

  it('rejects offChainURI with contract', () => {
    const res = validateProvenance({
      type: 'offChainURI',
      contract: { chain: 'evm', address: '0xabc' },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some(i => i.path === 'contract')).toBe(true);
    }
  });
});

describe('validatePlaylistItem', () => {
  it('accepts valid item', () => {
    const res = validatePlaylistItem({
      id: '550e8400-e29b-41d4-a716-446655440000',
      source: 'https://example.com/a',
      duration: 10,
      license: 'open',
      created: '2025-01-01T00:00:00.000Z',
    });
    expect(res.success).toBe(true);
  });

  it('rejects duration < 1', () => {
    const res = validatePlaylistItem({
      id: '550e8400-e29b-41d4-a716-446655440000',
      source: 'https://example.com/a',
      duration: 0,
      license: 'open',
      created: '2025-01-01T00:00:00.000Z',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some(i => i.path === 'duration')).toBe(true);
    }
  });
});
