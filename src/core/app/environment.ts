import type { PencilServices } from './services'
import type { PencilPlatform } from '../platform/runtime'

export interface WorkerBindings {
  readonly RER_MANAGEMENT_ORIGIN?: string
  readonly RER_INSTALLATION_ID?: string
  readonly RER_OWNER_CLAIM_ISSUER?: string
  readonly RER_OWNER_CLAIM_INSTALLATION_ID?: string
  readonly RER_OWNER_CLAIM_APP_ORIGIN?: string
  readonly RER_OWNER_CLAIM_PUBLIC_KEYS?: string
  readonly ASSETS: Fetcher
  // The deploy identity rer deploy binds and checks on /health (Base deployment-health).
  readonly RER_DEPLOY_SOURCE?: string
  readonly RER_DEPLOY_FINGERPRINT?: string
  readonly RER_VERSION?: { id: string }
  readonly DB: D1Database
  readonly APP_ORIGIN?: string
  readonly PENCIL_BUILD_ID?: string
  readonly SEED_ADMIN_EMAIL?: string
  readonly SEED_SAMPLE_DATA?: string
  readonly MAIL_PROVIDER?: string
  readonly MAIL_API_KEY?: string
  readonly MAIL_FROM?: string
  readonly TASK_PROVIDER?: string
  readonly TASK_WEBHOOK_URL?: string
  readonly TASK_API_KEY?: string
  readonly SESSION_SECRET?: string
  readonly SETUP_TOKEN?: string
  readonly PENCIL_LOCAL_DEVELOPMENT?: string
  /** Local runtimes only: the checkout's key gate and dev identity switch. `rer deploy` refuses both. */
  readonly RER_DEV_KEY?: string
  readonly RER_DEV_IDENTITY?: string
}

export type WorkerEnvironment = {
  Bindings: WorkerBindings
  Variables: {
    services: PencilServices
    platform: PencilPlatform
    operatorSession: {
      id: string
      expiresAt: string
      operatorId: string
      email: string
      displayName: string
      workspaceId: string
    }
  }
}
