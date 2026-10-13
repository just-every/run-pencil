import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { installCompiledLiveEdits, setLiveEditsReady } from './base/editor'
import compiled from './editor/visual-edits.json'
if (typeof document !== 'undefined') { setLiveEditsReady(false); installCompiledLiveEdits(compiled) }
export function getRouter() {
  const router = createRouter({ routeTree, scrollRestoration: true })
  if (typeof document !== 'undefined') router.subscribe('onBeforeLoad', () => setLiveEditsReady(false))
  return router
}
declare module '@tanstack/react-router' { interface Register { router: ReturnType<typeof getRouter> } }
