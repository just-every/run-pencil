import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PENCIL_E2E_PORT ?? '4173')
process.env.PENCIL_E2E_PORT ??= String(port)
process.env.PENCIL_MIGRATION_STATE ??= '.pencil-e2e-state/v3/d1/miniflare-D1DatabaseObject'
const externalServer = Boolean(process.env.PENCIL_E2E_BASE_URL)
const baseURL = process.env.PENCIL_E2E_BASE_URL ?? `http://127.0.0.1:${port}`

process.env.PENCIL_E2E_BASE_URL = baseURL
// The run site (run-pencil.com) the product page journeys read: built by rer build --site and served on its own port.
const sitePort = Number(process.env.PENCIL_E2E_SITE_PORT ?? '4174')
process.env.PENCIL_E2E_SITE_URL ??= `http://127.0.0.1:${sitePort}`
const externalSite = process.env.PENCIL_E2E_SITE_URL !== `http://127.0.0.1:${sitePort}`

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  // Playwright's pull-request git capture fetches the base commit at depth 1, which leaves the checkout shallow and breaks the release-tag ancestry and publication history checks that run after it.
  captureGitInfo: { commit: false, diff: false },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    ...(externalServer ? [] : [{
      command: `node scripts/run-e2e-server.mjs ${port}`,
      url: `${baseURL}/health`,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 15_000 },
      timeout: 120_000,
    }]),
    ...(externalSite ? [] : [{
      command: `node scripts/run-site-server.mjs ${sitePort}`,
      url: `${process.env.PENCIL_E2E_SITE_URL}/run`,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 15_000 },
      timeout: 180_000,
    }]),
  ],
})
