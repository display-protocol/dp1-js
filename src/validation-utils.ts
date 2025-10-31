import * as semver from 'semver';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { success: true }
  | { success: false; error: { message: string; issues: ValidationIssue[] } };

// Minimum DP-1 protocol version supported by this server
const MIN_DP_VERSION = '1.0.0';

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
