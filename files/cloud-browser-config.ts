import { defineConfig } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({
  ...base,
  webServer: Array.isArray(base.webServer) ? base.webServer.slice(0, 1) : base.webServer,
  use: { ...base.use, launchOptions: { headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] } },
})
