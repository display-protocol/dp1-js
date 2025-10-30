import type { z } from 'zod';
import * as semver from 'semver';
import { ProvenanceSchema, DisplayPrefsSchema, ReproSchema, PlaylistItemSchema } from './schema';

// Minimum DP-1 protocol version supported by this server
const MIN_DP_VERSION = '1.0.0';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { success: true }
  | { success: false; error: { message: string; issues: ValidationIssue[] } };

function zodIssuesToValidationIssues(issues: z.ZodIssue[]): ValidationIssue[] {
  return issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Validates that a dpVersion is valid semver and greater than or equal to MIN_DP_VERSION
 */
export function validateDpVersion(dpVersion: string): ValidationResult {
  // First check if it's valid semver
  if (!semver.valid(dpVersion)) {
    return {
      success: false,
      error: {
        message: `Invalid semantic version format: ${dpVersion}`,
        issues: [],
      },
    };
  }

  // Check if it meets minimum version requirement
  if (semver.lt(dpVersion, MIN_DP_VERSION)) {
    return {
      success: false,
      error: {
        message: `dpVersion ${dpVersion} is below minimum required version ${MIN_DP_VERSION}`,
        issues: [],
      },
    };
  }

  return { success: true };
}

export function validateDisplayPrefs(input: unknown): ValidationResult {
  const result = DisplayPrefsSchema.safeParse(input);
  if (result.success) {
    return { success: true };
  }

  const issues = zodIssuesToValidationIssues(result.error.issues);
  const detailedMessage = issues.map(i => `${i.path}: ${i.message}`).join('; ');

  return {
    success: false,
    error: {
      message: detailedMessage || 'Invalid display preferences',
      issues,
    },
  };
}

export function validateRepro(input: unknown): ValidationResult {
  const result = ReproSchema.safeParse(input);
  if (result.success) {
    return { success: true };
  }

  const issues = zodIssuesToValidationIssues(result.error.issues);
  const detailedMessage = issues.map(i => `${i.path}: ${i.message}`).join('; ');

  return {
    success: false,
    error: {
      message: detailedMessage || 'Invalid reproduction metadata',
      issues,
    },
  };
}

export function validateProvenance(input: unknown): ValidationResult {
  const result = ProvenanceSchema.safeParse(input);
  if (result.success) {
    return { success: true };
  }

  const issues = zodIssuesToValidationIssues(result.error.issues);
  const detailedMessage = issues.map(i => `${i.path}: ${i.message}`).join('; ');

  return {
    success: false,
    error: {
      message: detailedMessage || 'Invalid provenance',
      issues,
    },
  };
}

export function validatePlaylistItem(input: unknown): ValidationResult {
  const result = PlaylistItemSchema.safeParse(input);
  if (result.success) {
    return { success: true };
  }

  const issues = zodIssuesToValidationIssues(result.error.issues);
  const detailedMessage = issues.map(i => `${i.path}: ${i.message}`).join('; ');

  return {
    success: false,
    error: {
      message: detailedMessage || 'Invalid item in playlist',
      issues,
    },
  };
}
