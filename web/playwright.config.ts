import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)

/**
 * End-to-end + accessibility tests against a production build (`next start`).
 * Public-surface specs run against whatever Supabase project .env.local points
 * at without creating data. The signed-in journey (journey.spec.ts) runs only
 * with E2E_FULL=1 and seeded demo accounts — see docs/level-1/TEST_PLAN.md.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // The signed-in journey talks to a free-tier hosted database: keep concurrency low so
  // results reflect the app, not rate limits.
  workers: process.env.E2E_FULL ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
