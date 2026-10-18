import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { loadInvitation, loadPublicConfig } from '../core/app/loaders'
import { AccessGate } from '../core/features/restricted-access/AccessGate'
import { RespondentFlowPage } from '../core/features/responses/ui/RespondentFlowPage'
import { PublicClosedPage } from '../core/features/responses/ui/PublicClosedPage'
export const Route = createFileRoute('/i/$token')({ loader: async ({ params }) => ({ config: await loadPublicConfig(), data: await loadInvitation({ data: { token: params.token } }) }), component: editorLeaf(Page) })
function Page() {
  const { config, data } = Route.useLoaderData()
  const { token } = Route.useParams()
  if(data.state==='restricted')return <AccessGate config={config} restriction={data.restriction} invitationToken={token}/>
  if (data.state === 'closed') return <PublicClosedPage config={config} flow={data.flow} />
  return <RespondentFlowPage config={config} slug={data.flow.flow.slug} initialFlow={data.flow} invitationToken={token} />
}
