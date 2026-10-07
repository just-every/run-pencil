import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PENCIL_E2E_PORT ?? '4173')
process.env.PENCIL_E2E_PORT ??= String(port)
process.env.PENCIL_MIGRATION_STATE ??= '.pencil-e2e-state/v3/d1/miniflare-D1DatabaseObject'
const externalServer = Boolean(process.env.PENCIL_E2E_BASE_URL)
const baseURL = process.env.PENCIL_E2E_BASE_URL ?? `http://127.0.0.1:${port}`

process.env.PENCIL_E2E_BASE_URL = baseURL

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: externalServer
    ? undefined
    : {
        command: `node scripts/run-e2e-server.mjs ${port}`,
        url: `${baseURL}/health`,
        reuseExistingServer: false,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
        timeout: 120_000,
      },
})
