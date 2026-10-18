import { AccessGate } from '../../restricted-access/ui'
import type { AccessRequirement } from '../../restricted-access'
import { KioskFlow } from './KioskFlow'
import { RespondentFlowPage } from './RespondentFlowPage'
import { PublicClosedPage } from './PublicClosedPage'
import type { ClosedFlow, PublicFlow } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'
export function PublicDocument({ config, data, slug, landing, embedded, kioskIdleSeconds }: { config: PublicSeedConfig; data: {state:'restricted';restriction:AccessRequirement;collectorKey?:string} | { state: 'closed'; flow: ClosedFlow } | { state: 'open'; flow: PublicFlow; collectorKey?:string }; slug: string; landing?: boolean; embedded?: boolean; kioskIdleSeconds?: number }) {
  if(data.state==='restricted')return <AccessGate config={config} restriction={data.restriction} collectorKey={data.collectorKey} embedded={embedded} kioskIdleSeconds={kioskIdleSeconds}/>
  if (data.state === 'closed') return <PublicClosedPage config={config} flow={data.flow} landing={landing} embedded={embedded} />
  if (kioskIdleSeconds) return <KioskFlow config={config} data={data} slug={slug} idleSeconds={kioskIdleSeconds} />
  return <RespondentFlowPage key={`${slug}:${data.flow.revision.id}:${data.collectorKey ?? 'default'}`} collectorKey={data.collectorKey} config={config} initialFlow={data.flow} slug={slug} landing={landing} embedded={embedded} />
}
