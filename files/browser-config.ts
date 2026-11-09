import { defineConfig } from '/workspace/run-pencil/node_modules/@playwright/test'
import config from '/workspace/run-pencil/playwright.config'
export default defineConfig({
  ...config,
  testDir: '/workspace/run-pencil/tests/e2e',
  testMatch: 'closed-flow.spec.ts',
  outputDir: '/tmp/pencil-browser-results',
  use: { ...config.use, launchOptions: { ...config.use?.launchOptions, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] } },
  webServer: [{ ...config.webServer![0], cwd: '/workspace/run-pencil', timeout: 180_000 }],
})
