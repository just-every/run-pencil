import { chromium } from '@playwright/test'

// Use this checkout's bundled headless shell and Playwright's default args.
const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
try {
  const page = await browser.newPage()
  await page.goto('data:text/html,<title>Chromium launch probe</title>')
  if (await page.title() !== 'Chromium launch probe') throw new Error('Chromium launch probe did not render.')
} finally { await browser.close() }
