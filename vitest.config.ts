import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        lines: 41.27,
        statements: 41.15,
        branches: 48.71,
        functions: 42.85,
        'src/app/billing/domain/**/*.ts': { lines: 90 },
      },
    },
  },
});
