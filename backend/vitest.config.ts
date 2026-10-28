import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/types.ts', 'src/generated/**'],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Ratchet: a few points below the current coverage. Raise when coverage grows, never lower.
      // Global thresholds apply to the package as a whole, so entry points like main.ts may stay uncovered.
      thresholds: {
        statements: 95, branches: 95, functions: 95, lines: 95,
        'src/features/todos/{validators,mappers}.ts': {
          statements: 100, branches: 100, functions: 100, lines: 100,
        },
      },
    },
  },
});
