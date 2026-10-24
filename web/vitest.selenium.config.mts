import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/** Selenium WebDriver browser tests: `npm run test:selenium` (after `npm run build`). */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/selenium/**/*.test.ts'],
    globalSetup: ['tests/selenium/global-setup.ts'],
    setupFiles: ['tests/selenium/load-env.ts'],
    // Real browsers against one server: run files one after another.
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 120_000,
  },
})
