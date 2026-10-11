import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/db/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // `server-only` throws outside a React Server environment; stub it for unit tests.
    alias: { 'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)) },
  },
})
