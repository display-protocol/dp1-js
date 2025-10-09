import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base recommended rules
  tseslint.configs.recommended,

  // TypeScript source files
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
      // TypeScript specific rules
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

      // Code quality
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      curly: 'error',
      'no-debugger': 'error',
    },
  },

  // Test files
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

  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.cjs', '*.mjs'],
  }
);
