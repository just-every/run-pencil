import type { Trust } from '../base/agent-door/index.ts'
import type { PencilPlatform } from '../core/platform/runtime'

/** The same installation ring and canonical origin used by signed owner admission. */
export function pencilTrust(platform: PencilPlatform): Trust | null {
  const trust = platform.management.ownerClaim
  if (![trust.issuer, trust.installationId, trust.appOrigin, trust.publicKeys].some(Boolean)) return null
  if (!trust.issuer || !trust.installationId || !trust.appOrigin || !trust.publicKeys || trust.appOrigin !== platform.configuration.appOrigin) {
    throw new Error('Incomplete agent door trust configuration')
  }
  return { issuer: trust.issuer, installationId: trust.installationId, appOrigin: trust.appOrigin,
    publicKeys: JSON.parse(trust.publicKeys) as Trust['publicKeys'] }
}
