import { emailFirstAnswer } from '../core/shared/emailFirstQuestion'
import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { loadInvitation, loadPublicConfig } from '../core/app/loaders'
import { AccessGate } from '../core/features/restricted-access/AccessGate'
import { RespondentFlowPage } from '../core/features/responses/ui/RespondentFlowPage'
import { PublicClosedPage } from '../core/features/responses/ui/PublicClosedPage'
export const Route = createFileRoute('/i/$token')({ validateSearch: (search:Record<string,unknown>)=>({__pencil_first:search.__pencil_first}), loader: async ({ params }) => ({ config: await loadPublicConfig(), data: await loadInvitation({ data: { token: params.token } }) }), component: editorLeaf(Page) })
function Page() {
  const { config, data } = Route.useLoaderData()
  const { token } = Route.useParams()
  const { __pencil_first:first } = Route.useSearch()
  if(data.state==='restricted')return <AccessGate config={config} restriction={data.restriction} invitationToken={token} emailAnswerRaw={first}/>
  if (data.state === 'closed') return <PublicClosedPage config={config} flow={data.flow} />
  return <RespondentFlowPage config={config} slug={data.flow.flow.slug} initialFlow={data.flow} emailLanding={first!==undefined} initialEmailAnswer={data.flow.completedStepId ? undefined : emailFirstAnswer(data.flow,first)} invitationToken={token} />
}
