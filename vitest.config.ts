import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts', // Exclude index.ts (just exports)
        '**/types.ts', // Exclude types.ts (just type definitions)
      ],
    },
  },
});
