// Static rendering for the run site: each page is drawn inside a router held at its own path, so every TanStack Link
// on the approved homepage and the docs is written as a plain anchor with the same active state the app gives it.
import type { ReactElement } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import themeCss from '../core/app/theme.css?url'

interface Head {
  readonly meta: readonly Record<string, string | undefined>[]
  readonly links: readonly Record<string, string | undefined>[]
}

/** The body markup of `page` rendered at `path`. */
export async function bodyAt(path: string, page: () => ReactElement): Promise<string> {
  const root = createRootRoute()
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: '/', component: page }),
    createRoute({ getParentRoute: () => root, path: '$', component: page }),
  ])
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }), isServer: true })
  await router.load()
  return renderToStaticMarkup(<RouterProvider router={router as never} />)
}

/**
 * A complete document with the head every Pencil document has (routes/__root.tsx: charset, viewport and the product
 * stylesheet), then the page's own meta and links, as the app's head renders them, and any module `scripts`.
 */
export function documentHtml(head: Head, body: string, scripts: readonly string[] = []): string {
  const title = head.meta.find(row => row.title)?.title ?? 'Pencil'
  return '<!doctype html>' + renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {head.meta.filter(row => !row.title).map((row, index) => <meta key={index} {...row} />)}
        <link rel="stylesheet" href={themeCss} />
        {head.links.map((row, index) => <link key={index} {...row} />)}
        {scripts.map(src => <script key={src} type="module" src={src} />)}
      </head>
      <body dangerouslySetInnerHTML={{ __html: body }} />
    </html>,
  )
}

/**
 * Fills a page's island (`<div data-site-island="NAME">`, left empty by the static render) with `element` rendered
 * for hydration, which the run site's client script then hydrates in place.
 */
export function withIsland(body: string, name: string, element: ReactElement): string {
  const empty = `<div data-site-island="${name}" style="display:contents"></div>`
  if (body.split(empty).length !== 2) throw new Error(`The page has no single empty ${name} island.`)
  return body.replace(empty, () => `<div data-site-island="${name}" style="display:contents">${renderToString(element)}</div>`)
}
