import { editorLeaf } from '../editor/leaf'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { isFormDocument, previewHead } from '../core/features/link-preview/head'
import { loadPublicConfig, loadDocumentPreview } from '../core/app/loaders'
import css from '../core/app/theme.css?url'
import { NoteIllustration } from '../core/app/ui/NoteIllustration'
import { introCss, introGuardScript } from '../base/hydration/intro-guard'
export const Route = createRootRoute({
  loader: async ({location}) => ({config:await loadPublicConfig(), preview:await loadDocumentPreview({data:{path:location.pathname,search:location.searchStr}}),formDoor:isFormDocument(location.pathname)}),
  head: ({loaderData}) => { const head=previewHead(loaderData?.preview,loaderData?.formDoor ?? true); return {meta:[{charSet:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1'},{title:'Pencil'},...head.meta],links:[{rel:'icon',type:'image/svg+xml',href:'/brand/pencil-mark.svg'},{rel:'stylesheet',href:css},...head.links]} },
  notFoundComponent: editorLeaf(() => <main className="pencil-canvas respondent-shell"><section className="load-problem"><NoteIllustration className="load-problem__art" variant="snapped" /><h1 className="display load-problem__message">Form not found</h1><p className="muted">This address has no available Pencil form.</p></section></main>),
  // Base's intro guard follows the head, as early as it can be (src/base/hydration/README.md).
  component: () => <html lang="en"><head><HeadContent /><script dangerouslySetInnerHTML={{ __html: introGuardScript }} /><style>{introCss}</style></head><body><Outlet /><Scripts /></body></html>,
})
