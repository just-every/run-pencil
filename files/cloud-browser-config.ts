import config from '/workspace/run-pencil/playwright.config'
export default {
  ...config,
  testDir: '/workspace/run-pencil/tests/e2e',
  outputDir: '/workspace/run-pencil/test-results',
  use: {
    ...config.use,
    launchOptions: { headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] },
  },
  webServer: config.webServer.slice(0, 1).map(server => ({ ...server, cwd: '/workspace/run-pencil', timeout: 300_000 })),
}
