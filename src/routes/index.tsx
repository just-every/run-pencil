import { editorLeaf } from '../editor/leaf'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { loadPublicConfig, loadPublicFlow } from '../core/app/loaders'
import { PublicDocument } from '../core/features/responses/ui/PublicDocument'

// The installed `/` is the owner's selected public form. Without one the Worker answers `/` with the shared Lobby
// before this route renders; Pencil's marketing homepage is the run site's (src/site/pages.tsx).
export const Route = createFileRoute('/')({
  loader: async () => {
    const config = await loadPublicConfig()
    if (!config.publicFlowSlug) throw notFound()
    // An explicitly selected respondent landing retains its canonical admission and missing/closed states.
    return { config, data: await loadPublicFlow({ data: { slug: config.publicFlowSlug } }) }
  },
  component: editorLeaf(Page),
})

function Page() {
  const { config, data } = Route.useLoaderData()
  return <PublicDocument config={config} data={data} slug={config.publicFlowSlug} landing />
}
