import { defineConfig } from '@playwright/test'
import ordinary from './playwright.config'
export default defineConfig({
  ...ordinary, testDir: './tests/admission', retries: 0, workers: 1,
  webServer: {
    command: `node scripts/run-e2e-server.mjs ${process.env.PENCIL_E2E_PORT ?? '4173'} --management`,
    url: `${process.env.PENCIL_E2E_BASE_URL}/health`,
    reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 }, timeout: 120_000,
  },
})
