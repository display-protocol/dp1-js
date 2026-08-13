import { builtinModules } from 'node:module';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'no-debugger': 'error',
      // dp1-js ships one build for Node, browsers, and Cloudflare Workers. A `node:` import
      // breaks browser bundling, and the `Buffer` global exists in neither browsers nor
      // Workers without `nodejs_compat`. Use `src/runtime/*` instead. See #9 and #24.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message:
                'No node: imports in src/ — the build must load on browsers and Workers. Use src/runtime/* (bytes, ip, dns) instead.',
            },
            {
              // TypeScript resolves the bare forms through @types/node just as happily, and
              // the bundler rewrites `node:crypto` to `crypto` on the way out.
              group: builtinModules,
              message:
                'No Node builtin imports in src/ — the build must load on browsers and Workers. Use src/runtime/* (bytes, ip, dns) instead.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'Buffer',
          message:
            'The Buffer global is absent on browsers and on Workers without nodejs_compat. Use src/runtime/bytes.js instead.',
        },
        {
          name: 'process',
          message:
            'The process global is absent on browsers. Read it off globalThis behind a typeof guard, as src/runtime/dns.ts does.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      // Excluded from tsconfig (out of sync with current typings); still run by Vitest
      'tests/parity-extra.test.ts',
    ],
  }
);
