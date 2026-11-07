import { defineConfig } from '/workspace/run-pencil/node_modules/@playwright/test/index.mjs'
import original from '/workspace/run-pencil/playwright.config.ts'
export default defineConfig({
  ...original,
  testDir: '/workspace/run-pencil/tests/e2e',
  outputDir: '/workspace/run-pencil/test-results/cloud-ranked',
  use: {
    ...original.use,
    launchOptions: { ...original.use?.launchOptions, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] },
  },
  webServer: (original.webServer as any[]).slice(0, 1).map(server => ({ ...server, cwd: '/workspace/run-pencil' })),
})
