import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'dist/**',
        'tests/**',
        'scripts/**',
        '**/*.config.*',
        '**/*.d.ts',
        'src/index.ts',
      ],
    },
    testTimeout: 15_000,
    hookTimeout: 15_000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
});
