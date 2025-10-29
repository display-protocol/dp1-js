import { describe, it, expect } from 'vitest';
import { validateDpVersion, PlaylistSchema } from '../src/schema';

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

  describe('PlaylistSchema validation', () => {
    const basePlaylist = {
      dpVersion: '1.0.0',
      id: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'test-playlist',
      title: 'Test Playlist',
      created: '2025-01-01T00:00:00Z',
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Test Item',
          source: 'https://example.com/test',
          duration: 300,
          license: 'open' as const,
          created: '2025-01-01T00:00:00.001Z',
        },
      ],
      signature: 'ed25519:0x' + 'a'.repeat(128),
    };

    describe('items validation', () => {
      it('should reject empty items array', () => {
        const playlist = { ...basePlaylist, items: [] };
        const result = PlaylistSchema.safeParse(playlist);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            'Array must contain at least 1 element(s)'
          );
        }
      });

      it('should accept playlist with at least one item', () => {
        const result = PlaylistSchema.safeParse(basePlaylist);
        expect(result.success).toBe(true);
      });
    });

    describe('provenance validation', () => {
      const validOnChainProvenance = {
        type: 'onChain' as const,
        contract: {
          chain: 'evm' as const,
          standard: 'erc721' as const,
          address: '0x1234567890abcdef',
          tokenId: '42',
        },
      };

      const validSeriesRegistryProvenance = {
        type: 'seriesRegistry' as const,
        contract: {
          chain: 'tezos' as const,
          standard: 'fa2' as const,
          address: 'KT1ABC123',
          seriesId: 1,
        },
      };

      const validOffChainURIProvenance = {
        type: 'offChainURI' as const,
        dependencies: [
          {
            chain: 'evm' as const,
            uri: 'https://example.com/metadata',
          },
        ],
      };

      it('should require contract when provenance type is onChain', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: {
                type: 'onChain' as const,
                // contract is missing
              },
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(i => i.message.includes('contract is required'))).toBe(
            true
          );
        }
      });

      it('should require contract when provenance type is seriesRegistry', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: {
                type: 'seriesRegistry' as const,
                // contract is missing
              },
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(i => i.message.includes('contract is required'))).toBe(
            true
          );
        }
      });

      it('should reject contract when provenance type is offChainURI', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: {
                type: 'offChainURI' as const,
                contract: {
                  chain: 'evm' as const,
                  address: '0x1234567890abcdef',
                },
              },
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some(i => i.message.includes('contract is not allowed'))).toBe(
            true
          );
        }
      });

      it('should accept valid onChain provenance with contract', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: validOnChainProvenance,
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(true);
      });

      it('should require address for onChain provenance', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: {
                type: 'onChain' as const,
                contract: {
                  chain: 'evm' as const,
                  // address missing
                  tokenId: '42',
                },
              },
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some(i =>
              i.message.includes(
                'contract.address is required for onChain or seriesRegistry provenance'
              )
            )
          ).toBe(true);
        }
      });

      it('should require tokenId for onChain provenance', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: {
                type: 'onChain' as const,
                contract: {
                  chain: 'evm' as const,
                  address: '0x1234567890abcdef',
                  // tokenId missing
                },
              },
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some(i =>
              i.message.includes('contract.tokenId is required when provenance type is onChain')
            )
          ).toBe(true);
        }
      });

      it('should accept valid seriesRegistry provenance with contract', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: validSeriesRegistryProvenance,
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(true);
      });

      it('should require address for seriesRegistry provenance', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: {
                type: 'seriesRegistry' as const,
                contract: {
                  chain: 'tezos' as const,
                  // address missing
                  seriesId: 1,
                },
              },
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some(i =>
              i.message.includes(
                'contract.address is required for onChain or seriesRegistry provenance'
              )
            )
          ).toBe(true);
        }
      });

      it('should require seriesId for seriesRegistry provenance', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: {
                type: 'seriesRegistry' as const,
                contract: {
                  chain: 'tezos' as const,
                  address: 'KT1ABC123',
                  // seriesId missing
                },
              },
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some(i =>
              i.message.includes(
                'contract.seriesId is required when provenance type is seriesRegistry'
              )
            )
          ).toBe(true);
        }
      });

      it('should accept valid offChainURI provenance without contract', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              provenance: validOffChainURIProvenance,
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(true);
      });

      it('should accept playlist items without provenance', () => {
        const playlist = {
          ...basePlaylist,
          items: [
            {
              ...basePlaylist.items[0],
              // no provenance field
            },
          ],
        };

        const result = PlaylistSchema.safeParse(playlist);
        expect(result.success).toBe(true);
      });
    });
  });
});
