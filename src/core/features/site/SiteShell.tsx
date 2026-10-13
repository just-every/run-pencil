import type { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

/** The id of each site page's `<main>`, the skip link's default target. */
export const siteMainId = 'content'

/**
 * Chrome for every product site page (`/pencil`, `/docs`): the `.pencil-site` scope that carries the paper tokens and
 * neutralises the dark product theme, a skip link, the header, the page's `<main>` and the footer. The skip link goes to
 * `skipTarget`: the `<main>`, unless the page has repeated navigation inside it and names the element after that (the docs article).
 */
export function SiteShell({ children, skipTarget = `#${siteMainId}` }: { readonly children: ReactNode; readonly skipTarget?: string }) {
  return (
    <div className="pencil-site">
      <a className="site-skip" href={skipTarget}>Skip to content</a>
      <SiteHeader />
      <main id={siteMainId} className="site-main" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </div>
  )
}
