import { z } from 'zod';
import { validateDpVersion } from './validators';

// Zod Schemas for Request Validation

// Display Preferences Schema
export const DisplayPrefsSchema = z
  .object({
    scaling: z.enum(['fit', 'fill', 'stretch', 'auto']).optional(),
    margin: z
      .union([z.number().min(0), z.string().regex(/^[0-9]+(\.[0-9]+)?(px|%|vw|vh)$/)])
      .optional(),
    background: z
      .string()
      .regex(/^(#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})|transparent)$/)
      .optional(),
    autoplay: z.boolean().optional(),
    loop: z.boolean().optional(),
    interaction: z
      .object({
        keyboard: z.array(z.string()).optional(),
        mouse: z
          .object({
            click: z.boolean().optional(),
            scroll: z.boolean().optional(),
            drag: z.boolean().optional(),
            hover: z.boolean().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .optional();

// Reproduction Schema
export const ReproSchema = z
  .object({
    engineVersion: z.record(z.string()),
    seed: z
      .string()
      .regex(/^0x[a-fA-F0-9]+$/)
      .max(130)
      .optional(),
    assetsSHA256: z
      .array(
        z
          .string()
          .regex(/^0x[a-fA-F0-9]+$/)
          .max(66)
      )
      .max(1024),
    frameHash: z.object({
      sha256: z
        .string()
        .regex(/^0x[a-fA-F0-9]+$/)
        .max(66),
      phash: z
        .string()
        .regex(/^0x[a-fA-F0-9]+$/)
        .max(18)
        .optional(),
    }),
  })
  .optional();

// Provenance Schema
export const ProvenanceSchema = z
  .object({
    type: z.enum(['onChain', 'seriesRegistry', 'offChainURI']),
    contract: z
      .object({
        chain: z.enum(['evm', 'tezos', 'bitmark', 'other']),
        standard: z.enum(['erc721', 'erc1155', 'fa2', 'other']).optional(),
        address: z.string().max(48).optional(),
        seriesId: z.union([z.number().min(0).max(4294967295), z.string().max(128)]).optional(),
        tokenId: z.string().max(128).optional(),
        uri: z
          .string()
          .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
          .max(1024)
          .optional(),
        metaHash: z
          .string()
          .regex(/^0x[a-fA-F0-9]+$/)
          .max(66)
          .optional(),
      })
      .optional(),
    dependencies: z
      .array(
        z.object({
          chain: z.enum(['evm', 'tezos', 'bitmark', 'other']),
          standard: z.enum(['erc721', 'erc1155', 'fa2', 'other']).optional(),
          uri: z
            .string()
            .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
            .max(1024),
        })
      )
      .max(1024)
      .optional(),
  })
  .refine(
    data => {
      // If type is 'onChain' or 'seriesRegistry', contract is required
      if (data.type === 'onChain' || data.type === 'seriesRegistry') {
        return data.contract !== undefined;
      }
      return true;
    },
    {
      message: 'contract is required when provenance on chain or in series registry',
      path: ['contract'],
    }
  )
  .refine(
    data => {
      // When contract is required (onChain/seriesRegistry), address must be present
      if (data.type === 'onChain' || data.type === 'seriesRegistry') {
        return !!data.contract?.address;
      }
      return true;
    },
    {
      message: 'contract.address is required for onChain or seriesRegistry provenance',
      path: ['contract', 'address'],
    }
  )
  .refine(
    data => {
      // For onChain, tokenId is required
      if (data.type === 'onChain') {
        return !!data.contract?.tokenId;
      }
      return true;
    },
    {
      message: 'contract.tokenId is required when provenance type is onChain',
      path: ['contract', 'tokenId'],
    }
  )
  .refine(
    data => {
      // For seriesRegistry, seriesId is required
      if (data.type === 'seriesRegistry') {
        return data.contract?.seriesId !== undefined;
      }
      return true;
    },
    {
      message: 'contract.seriesId is required when provenance type is seriesRegistry',
      path: ['contract', 'seriesId'],
    }
  )
  .refine(
    data => {
      // If type is 'offChainURI', contract should not be present
      if (data.type === 'offChainURI') {
        return data.contract === undefined;
      }
      return true;
    },
    {
      message: 'contract is not allowed when provenance is off chain URI',
      path: ['contract'],
    }
  )
  .optional();

// Playlist Item Schema
export const PlaylistItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(256).optional(),
  source: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024),
  duration: z.number().min(1),
  license: z.enum(['open', 'token', 'subscription']),
  ref: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/)
    .max(1024)
    .optional(),
  override: z.record(z.unknown()).optional(),
  display: DisplayPrefsSchema,
  repro: ReproSchema,
  provenance: ProvenanceSchema,
  created: z.string().datetime(),
});

// Complete schemas with server-generated fields for output
export const PlaylistSchema = z.object({
  dpVersion: z
    .string()
    .max(16)
    .refine(
      version => {
        const validation = validateDpVersion(version);
        return validation.success;
      },
      version => {
        const validation = validateDpVersion(version);
        return {
          message:
            (validation as { error: { message: string } }).error.message || 'Invalid dpVersion',
        };
      }
    ),
  id: z.string().uuid(),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/)
    .max(64),
  title: z.string().max(256),
  created: z.string().datetime(),
  defaults: z
    .object({
      display: DisplayPrefsSchema,
      license: z.enum(['open', 'token', 'subscription']).optional(),
      duration: z.number().min(1).optional(),
    })
    .optional(),
  items: z.array(PlaylistItemSchema).min(1).max(1024),
  signature: z
    .string()
    .regex(/^ed25519:0x[a-fA-F0-9]+$/)
    .max(150),
});
