import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { loadPublicConfig } from '../core/app/loaders'
import css from '../core/app/theme.css?url'
export const Route = createRootRoute({
  loader: () => loadPublicConfig(),
  head: () => ({ meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: 'Pencil' }], links: [{ rel: 'stylesheet', href: css }] }),
  notFoundComponent: () => <main className="pencil-canvas respondent-shell"><section className="panel" style={{ padding: '3rem' }}><h1>Form not found</h1><p>This address has no available Pencil form.</p></section></main>,
  component: () => <html lang="en"><head><HeadContent /></head><body><Outlet /><Scripts /></body></html>,
})
