import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Unit tests for logic that does not need a browser: the visibility rule, the
 * error envelope, small components. The browser suite (Playwright) covers
 * the journeys; this covers the reasoning.
 */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
})
