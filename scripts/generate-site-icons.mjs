/**
 * Regenerates the product site's mark and icons from src/core/features/site/brand/mark.ts, the data PencilMark.tsx
 * renders. Run `node scripts/generate-site-icons.mjs` after the artwork changes and commit the output; nothing here
 * runs at build or request time. Needs Node with TypeScript type stripping (22.18+) and the Playwright Chromium used
 * by the browser checks (`pnpm exec playwright install chromium --only-shell`).
 *
 * Writes into src/core/features/site/brand/:
 * - favicon.svg: the mark, with its outline lightened when the browser theme is dark.
 * - favicon-32.png: the mark at 32x32 on a transparent ground.
 * - apple-touch-icon.png: the mark at 180x180 on the site's paper colour.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { markParts, markTransform, markViewBox } from '../src/core/features/site/brand/mark.ts'

const brand = fileURLToPath(new URL('../src/core/features/site/brand/', import.meta.url))
const paper = '#fbfaf6'

function path(part) {
  const stroke = part.stroke ? ` stroke="${part.stroke}" stroke-width="${part.strokeWidth}"` : ''
  return `<path${part.outline ? ' class="outline"' : ''} d="${part.d}" fill="${part.fill ?? 'none'}"${stroke}/>`
}

function svg(style = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${markViewBox}" width="32" height="32">${style}<g transform="${markTransform}" stroke-linejoin="round" stroke-linecap="round">${markParts.map(path).join('')}</g></svg>\n`
}

const mark = svg()
const favicon = svg(`<style>@media (prefers-color-scheme: dark) { .outline { stroke: ${paper}; } }</style>`)
await writeFile(`${brand}favicon.svg`, favicon)

const browser = await chromium.launch()
try {
  const page = await (await browser.newContext({ colorScheme: 'light', deviceScaleFactor: 1 })).newPage()
  async function render(markup, size, { inset = 0, background } = {}) {
    const side = Math.round(size * (1 - 2 * inset))
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px;background:${background ?? 'transparent'};display:grid;place-items:center}svg{width:${side}px;height:${side}px;display:block}</style>${markup}`)
    return page.screenshot({ type: 'png', omitBackground: !background, clip: { x: 0, y: 0, width: size, height: size } })
  }
  await writeFile(`${brand}favicon-32.png`, await render(mark, 32))
  await writeFile(`${brand}apple-touch-icon.png`, await render(mark, 180, { inset: 0.14, background: paper }))
} finally {
  await browser.close()
}
console.log(`Wrote favicon.svg, favicon-32.png and apple-touch-icon.png to ${brand}`)
