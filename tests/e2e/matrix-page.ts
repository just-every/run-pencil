import type { Browser, BrowserContextOptions, Page, TestInfo } from '@playwright/test'

// A matrix case keeps the fresh context and per-case artifacts that separate
// registrations had, while inheriting the runner's actual device and headers.
export async function isolatedMatrixPage(
  browser: Browser, options: BrowserContextOptions, testInfo: TestInfo, label: string,
  body: (page: Page, info: TestInfo) => Promise<void>,
) {
  const context = await browser.newContext(options)
  try {
    const info = Object.create(testInfo) as TestInfo
    const directory = label.replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 120)
    info.outputPath = (...paths) => testInfo.outputPath(directory, ...paths)
    await body(await context.newPage(), info)
  } finally { await context.close() }
}
