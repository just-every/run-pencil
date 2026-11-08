import base from '../playwright.config'
export default {
  ...base,
  testDir: '../tests/e2e',
  use: { ...base.use, launchOptions: { ...base.use?.launchOptions, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] } },
  webServer: (Array.isArray(base.webServer) ? base.webServer : [base.webServer]).filter(Boolean).map(server => ({ ...server, cwd: process.cwd() })),
}
