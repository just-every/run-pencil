import { createFileRoute } from '@tanstack/react-router'
import { loadPublicConfig, loadPublicFlow } from '../core/app/loaders'
import { PublicDocument } from '../core/features/responses/ui/PublicDocument'
export const Route = createFileRoute('/embed/$slug')({ loader: async ({ params }) => { return { config: await loadPublicConfig(), data: await loadPublicFlow({ data: { slug: params.slug } }) } }, component: Page })
function Page() { const { config, data } = Route.useLoaderData(); return <PublicDocument config={config} data={data} slug={Route.useParams().slug} embedded /> }
