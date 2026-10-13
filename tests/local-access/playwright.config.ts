import { join } from 'node:path'
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: 'first-run.spec.ts', workers: 1, retries: 0, timeout: 90_000,
  outputDir: process.env.PENCIL_ACCESS_EVIDENCE ? join(process.env.PENCIL_ACCESS_EVIDENCE, `artifacts-${process.env.PENCIL_ACCESS_VIEWPORT ?? 'desktop'}`) : undefined,
  use: { baseURL: process.env.PENCIL_E2E_BASE_URL, extraHTTPHeaders: { Origin: process.env.PENCIL_E2E_BASE_URL! }, trace: 'off' },
  projects: [{ name: process.env.PENCIL_ACCESS_VIEWPORT ?? 'desktop', use: { viewport: process.env.PENCIL_ACCESS_VIEWPORT === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 } } }],
})
