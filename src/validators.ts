import type { z } from 'zod';
import { ProvenanceSchema, DisplayPrefsSchema, ReproSchema, PlaylistItemSchema } from './schema';
import type { ValidationIssue, ValidationResult } from './validation-utils';

function zodIssuesToValidationIssues(issues: z.ZodIssue[]): ValidationIssue[] {
  return issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
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

export { validateDpVersion } from './validation-utils';
export type { ValidationResult, ValidationIssue } from './validation-utils';

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
