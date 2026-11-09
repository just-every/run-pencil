import config from '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil/playwright.config.ts'
export default {
  ...config,
  webServer: (config.webServer as Array<object>).map(server => ({ ...server, cwd: '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil' })),
  testDir: '/home/agent/rer-consolidation/work/sd-pencil-c-f60/run-pencil/tests/e2e',
  outputDir: '/home/agent/rer-consolidation/work/sd-pencil-c-f60/browser-results',
  use: { ...config.use, launchOptions: { ...config.use?.launchOptions, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] } },
}
