import { createFileRoute } from '@tanstack/react-router'
import { loadPublicConfig, loadPublicFlow } from '../core/app/loaders'
import { PublicDocument } from '../core/features/responses/ui/PublicDocument'
export const Route = createFileRoute('/')({ loader: async ({ params }) => { const config = await loadPublicConfig(); return { config, data: await loadPublicFlow({ data: { slug: config.publicFlowSlug } }) } }, component: Page })
function Page() { const { config, data } = Route.useLoaderData(); return <PublicDocument config={config} data={data} slug={config.publicFlowSlug} landing /> }
