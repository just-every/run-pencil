import { parseConfig } from '../../base/editor/config'
import type { WorkerBindings } from '../app/environment'

export function readManagementConfiguration(bindings: WorkerBindings) {
  return {
    editor: { managementOrigin: bindings.RER_MANAGEMENT_ORIGIN, installationId: bindings.RER_INSTALLATION_ID },
    ownerClaim: {
      issuer: bindings.RER_OWNER_CLAIM_ISSUER, installationId: bindings.RER_OWNER_CLAIM_INSTALLATION_ID,
      // A hosted demo's front signs the claim for the origin it supplies as APP_ORIGIN; everywhere else the claim origin is explicit.
      appOrigin: bindings.RER_OWNER_CLAIM_APP_ORIGIN ?? (bindings.RER_DEMO === '1' ? bindings.APP_ORIGIN : undefined), publicKeys: bindings.RER_OWNER_CLAIM_PUBLIC_KEYS,
    },
  }
}
export type ManagementConfiguration = ReturnType<typeof readManagementConfiguration>

export function editorConfiguration(settings: ManagementConfiguration['editor']) {
  if (!settings.managementOrigin && !settings.installationId) return null
  return parseConfig({ enabled: true, ...settings })
}

export function editorPolicy(existing: string, bindings: WorkerBindings) {
  let origin: string | undefined
  try { origin = editorConfiguration(readManagementConfiguration(bindings).editor)?.managementOrigin } catch { /* Invalid config stays disabled. */ }
  const retained = existing.split(';').map(value => value.trim()).filter(value => value && !/^frame-(src|ancestors)\b/.test(value))
  return [...retained, `frame-ancestors 'self'${origin ? ` ${origin}` : ''}`, `frame-src 'self'${origin ? ` ${origin}` : ''}`].join('; ')
}
