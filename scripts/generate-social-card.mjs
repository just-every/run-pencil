/**
 * Regenerates the product site's social card, src/core/features/site/brand/social-card.png: the 1200 x 630 image that
 * /pencil and /docs name as og:image. It is the site's own look, rendered from the site's own source: the paper,
 * the lockup, the hero headline and the live note card (NoteCard.tsx with its art, handwriting and pencil filters,
 * server-rendered as a visitor without JavaScript sees it), styled by the site and hero stylesheets with the bundled
 * fonts. Run `node scripts/generate-social-card.mjs` after the hero, its art or the site's look changes and commit the
 * output; nothing here runs at build or request time. Needs the Playwright Chromium used by the browser checks
 * (`pnpm exec playwright install chromium --only-shell`).
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import react from '@vitejs/plugin-react'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = fileURLToPath(new URL('../src/core/features/site/brand/social-card.png', import.meta.url))
const size = { width: 1200, height: 630 }
/** The hero's headline (landing-hero/Hero.tsx) and the category it names, as the card's copy. */
const headline = 'Ask like you’re listening.'
const category = 'The open-source form builder that asks only what fits each answer.'

const layout = `
html, body { margin: 0; width: ${size.width}px; height: ${size.height}px; overflow: hidden; background: var(--paper); }
.pencil-site.social { display: block; position: relative; width: ${size.width}px; height: ${size.height}px; min-height: 0; overflow: hidden; }
.social__copy { position: absolute; left: 72px; top: 96px; width: 494px; }
.social .site-lockup { font-size: 30px; }
.pencil-site .social__title { margin-top: 66px; max-width: 6.4em; font-size: 78px; line-height: 1.02; }
.social__category { margin: 30px 0 0; max-width: 19em; color: var(--ink-soft); font-size: 25px; line-height: 1.45; }
.social__card { position: absolute; left: 574px; top: 76px; width: 670px; }
.social .note-trail { display: none; }
`

async function page(vite) {
  const load = path => vite.ssrLoadModule(path)
  const [{ NoteCard }, { PencilMark }, { PencilFilters }] = await Promise.all([
    load('/src/core/features/landing-hero/NoteCard.tsx'),
    load('/src/core/features/site/PencilMark.tsx'),
    load('/src/core/features/site/PencilFilters.tsx'),
  ])
  const body = renderToStaticMarkup(
    h('div', { className: 'pencil-site social' },
      h(PencilFilters),
      h('div', { className: 'social__copy' },
        h('span', { className: 'site-lockup' }, h(PencilMark, { size: 46 }), h('span', null, 'Pencil')),
        h('h1', { className: 'social__title' }, headline),
        h('p', { className: 'social__category' }, category)),
      h('div', { className: 'social__card' }, h(NoteCard))),
  )
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/src/core/features/site/styles/site.css">
<link rel="stylesheet" href="/src/core/features/landing-hero/styles/landing-hero.css">
<style>${layout}</style></head><body>${body}</body></html>`
}

const vite = await createServer({
  root,
  configFile: false,
  logLevel: 'warn',
  appType: 'custom',
  server: { host: '127.0.0.1', port: 0 },
  plugins: [react(), {
    name: 'social-card-page',
    configureServer(server) {
      server.middlewares.use('/social-card', (_request, response, next) => {
        page(server).then(html => response.setHeader('Content-Type', 'text/html; charset=utf-8').end(html), next)
      })
    },
  }],
})
await vite.listen()
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' })
  const tab = await context.newPage()
  await tab.goto(new URL('/social-card', vite.resolvedUrls.local[0]).href, { waitUntil: 'load' })
  await tab.evaluate(async () => {
    await Promise.all(['400 82px "DM Serif Display"', '400 25px "DM Sans"', '600 30px "DM Sans"', '400 32px Caveat'].map(face => document.fonts.load(face)))
    await document.fonts.ready
    for (const image of document.images) await image.decode()
  })
  // The card art's surround is opaque paper, so the copy must end before the card begins.
  const [copyRight, cardLeft] = await tab.evaluate(() => {
    const range = document.createRange()
    range.selectNodeContents(document.querySelector('.social__copy'))
    return [range.getBoundingClientRect().right, document.querySelector('.social__card').getBoundingClientRect().left]
  })
  if (copyRight > cardLeft) throw new Error(`The copy (to x=${copyRight}) runs under the card (from x=${cardLeft}).`)
  await writeFile(output, await tab.screenshot({ type: 'png', clip: { x: 0, y: 0, ...size } }))
} finally {
  await browser.close()
  await vite.close()
}
console.log(`Wrote ${output}`)
