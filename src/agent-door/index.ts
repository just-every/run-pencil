import { createAgentDoor } from '../base/agent-door/index.ts'
import { createBusinessSettings } from '../base/business-settings/index.ts'
import type { PencilServices } from '../core/app/services'
import type { WorkerBindings } from '../core/app/environment'
import type { PencilPlatform } from '../core/platform/runtime'
import { pencilPeople } from './people.ts'
import { pencilTrust } from './trust.ts'
import { flowTools, flowResources } from './flow-tools.ts'

export const capabilities = ['tools', 'policy', 'pause', 'audit', 'idempotency', 'resources'] as const
export const notTools = [
  { clauses: ['IMPORT-001', 'IMPORT-002', 'IMPORT-003', 'IMPORT-004', 'IMPORT-005', 'IMPORT-006', 'IMPORT-007', 'IMPORT-008'], reason: 'import-door' as const },
  { clauses: ['BASE-AGENT-003'], reason: 'installation' as const },
  { clauses: ['BASE-AGENT-003'], reason: 'connector' as const },
  { clauses: ['BASE-AGENT-003'], reason: 'screen' as const },
]

export function pencilAgentDoor(bindings: WorkerBindings, platform: PencilPlatform, services: PencilServices) {
  const { people, nativeOperator, ownerEmail } = pencilPeople(bindings.DB, services)
  const settings = createBusinessSettings({ db: bindings.DB, trust: bindings.RER_BUSINESS_TRUST,
    business: { settings: 1, values: ['display_name'] }, team: { ownerEmail, async prepare() {
      throw new Error('Pencil has not declared Business team reconciliation')
    } } })
  const door = createAgentDoor({ seed: 'pencil', name: 'Pencil', specialist: 'form-design',
    db: bindings.DB, origin: platform.configuration.appOrigin, trust: pencilTrust(platform), capabilities,
    people, tools: flowTools(services, nativeOperator), resources: flowResources(services, nativeOperator), notTools })
  return { door, settings, async handle(request: Request) {
    return await settings.handle(request) ?? await door.handle(request)
  } }
}
