import { RespondentFlowPage } from './RespondentFlowPage'
import { PublicClosedPage } from './PublicClosedPage'
import type { ClosedFlow, PublicFlow } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'
export function PublicDocument({ config, data, slug, landing, embedded }: { config: PublicSeedConfig; data: { state: 'closed'; flow: ClosedFlow } | { state: 'open'; flow: PublicFlow }; slug: string; landing?: boolean; embedded?: boolean }) {
  if (data.state === 'closed') return <PublicClosedPage config={config} flow={data.flow} landing={landing} embedded={embedded} />
  return <RespondentFlowPage key={`${slug}:${data.flow.revision.id}`} config={config} initialFlow={data.flow} slug={slug} landing={landing} embedded={embedded} />
}
