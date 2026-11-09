import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const require = createRequire(join(process.cwd(), 'package.json'))
const { checkoutPlaywright } = await import(pathToFileURL(require.resolve('@runeditrun/rer/internal/cli/browser-runtime.mjs')))
const { playwright } = checkoutPlaywright(process.cwd())
const launch = playwright.chromium.launch.bind(playwright.chromium)
playwright.chromium.launch = (options = {}) => launch({ ...options, executablePath: '/usr/bin/chromium',
  args: [...(options.args ?? []), '--no-sandbox'] })
