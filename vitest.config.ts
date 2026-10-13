import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80,
        'src/app/billing/domain/**/*.ts': { lines: 90 },
      },
    },
  },
});
