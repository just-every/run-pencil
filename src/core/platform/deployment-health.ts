import { deploymentHealth as directDeploymentHealth } from '../../base/deployment-health'
import type { WorkerBindings } from '../app/environment'

declare const __PENCIL_MANAGED_SOURCE_SHA__: string | null

/** Managed identity uses the built source and the broker's published release. */
export function deploymentHealth(environment: WorkerBindings) {
  if (environment.RER_RELEASE_DIGEST !== undefined) {
    return {
      ok: true as const,
      deployment: {
        sourceSha: __PENCIL_MANAGED_SOURCE_SHA__,
        fingerprint: environment.RER_RELEASE_DIGEST,
        versionId: environment.RER_VERSION_METADATA?.id ?? null,
      },
    }
  }
  return directDeploymentHealth(environment)
}
