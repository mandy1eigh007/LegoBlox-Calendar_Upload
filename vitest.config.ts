import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['client/src/**/*.test.{ts,tsx}', 'client/src/**/__tests__/**/*.test.{ts,tsx}', 'client/src/**/__tests__/**/*.ts', 'client/src/**/__tests__/**/*.tsx'],
    threads: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
});
