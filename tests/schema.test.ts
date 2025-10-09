import { describe, it, expect } from 'vitest';
import { validateDpVersion } from '../src/schema';

describe('Schema Validation Functions', () => {
  describe('validateDpVersion', () => {
    it('should validate a valid version that meets minimum requirement', () => {
      const result = validateDpVersion('1.0.0');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate a version higher than minimum', () => {
      const result = validateDpVersion('2.0.0');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid semantic version format', () => {
      const result = validateDpVersion('not-a-version');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid semantic version format: not-a-version');
    });

    it('should reject version below minimum required', () => {
      const result = validateDpVersion('0.9.0');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('is below minimum required version');
      expect(result.error).toContain('0.9.0');
    });

    it('should reject empty version string', () => {
      const result = validateDpVersion('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid semantic version format');
    });

    it('should reject malformed version strings', () => {
      const testCases = ['1.0', '1.0.0-', 'abc.def.ghi', 'not.a.version'];

      testCases.forEach(version => {
        const result = validateDpVersion(version);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid semantic version format');
      });
    });
  });
});
