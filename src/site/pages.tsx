// The run site `rer build --site` writes (run-pencil.com): the approved homepage with its primary action opening the
// Run page, /run, the guide at /docs, and the not-found page. It reads no installation data, only edition identity,
// Run data and the repository's docs.
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { DocsPage, DocsShell, docsHead, loadDocsPage } from '../core/features/docs'
import { PencilPage, pencilHead } from '../core/features/landing/PencilPage'
import { NoteCard } from '../core/features/landing-hero/NoteCard'
import client from 'virtual:pencil-site-client'
import { SiteVariantProvider, withSocialCard } from '../core/features/site'
import { identity } from '../identity'
import { bodyAt, documentHtml, withIsland } from './render'
import { run } from './run'

async function docsPage(slug: string) {
  const view = await loadDocsPage(slug)
  const path = slug ? `/docs/${slug}` : '/docs'
  const body = await bodyAt(path, () => <SiteVariantProvider variant="site"><DocsShell><DocsPage {...view} /></DocsShell></SiteVariantProvider>)
  return { path, html: documentHtml(await withSocialCard(docsHead(view.page), identity.runSite), body) }
}

export async function sitePages({ contract }: Partial<SiteContext> = {}): Promise<SiteBuild> {
  const { sections } = await import('virtual:pencil-docs')
  const slugs = sections.flatMap(section => section.pages.map(page => page.slug))
  return {
    pages: [
      { path: '/', html: documentHtml(await pencilHead(identity.runSite), withIsland(await bodyAt('/', () => <PencilPage variant="site" />), 'note-card', <NoteCard />), [client]) },
      { path: '/run', html: runPageHtml(identity, run, contract) },
      ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, run, contract) }] : []),
      ...await Promise.all(slugs.map(docsPage)),
      { path: '/404', html: siteNotFoundHtml(identity, run, contract) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand'],
  }
}
