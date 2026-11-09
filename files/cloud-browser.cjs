const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const localRequire = createRequire(resolve(process.cwd(), 'package.json'));
const patched = new Set();
for (const name of ['playwright-core', '@playwright/test', 'playwright']) {
  let chromium;
  try { chromium = localRequire(name).chromium; } catch { continue; }
  if (!chromium || patched.has(chromium)) continue;
  patched.add(chromium);
  const launch = chromium.launch.bind(chromium);
  chromium.launch = (options = {}) => launch({ ...options, executablePath: '/usr/bin/chromium', args: [...(options.args ?? []), '--no-sandbox'] });
}
