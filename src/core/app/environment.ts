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
  readonly SEED_ADMIN_EMAIL?: string
  readonly SEED_SAMPLE_DATA?: string
  readonly MAIL_PROVIDER?: string
  readonly MAIL_API_KEY?: string
  readonly MAIL_RELAY_URL?: string
  readonly MAIL_FROM?: string
  readonly TASK_PROVIDER?: string
  readonly TASK_WEBHOOK_URL?: string
  readonly TASK_API_KEY?: string
  /** ai.provider.v1 (Base ai): off unless AI_ENABLED is true. Exactly one transport: a direct key or a linked Models service. */
  readonly AI_ENABLED?: string
  readonly AI_MODEL?: string
  readonly AI_API_KEY?: string
  readonly AI_BASE_URL?: string
  readonly MODELS_SERVICE?: string
  readonly MODELS_KEY?: string
  /** Optional owner rates for a direct key (USD per million tokens); without them a direct call's cost is not reported. */
  readonly AI_INPUT_USD_PER_MILLION_TOKENS?: string
  readonly AI_OUTPUT_USD_PER_MILLION_TOKENS?: string
  readonly SESSION_SECRET?: string
  readonly SETUP_TOKEN?: string
  readonly PENCIL_LOCAL_DEVELOPMENT?: string
  /** Local runtimes only: the checkout's key gate and dev identity switch. `rer deploy` refuses both. */
  readonly RER_DEV_KEY?: string
  readonly RER_DEV_IDENTITY?: string
  /** Local runtimes only: `rer dev --models live` hands the capped Models dev app here; server.dev.ts builds the dev client. */
  readonly RER_MODELS_SERVICE?: string
  readonly RER_MODELS_KEY?: string
  readonly PENCIL_DEV_AI?: import('../platform/ai/provider').DevAiFactory
  /** Demo mode only (`rer demo` or a hosted demo container; Base modules/demo): `rer deploy` refuses it. The hosted demo's
   * front also supplies the demo owner as OWNER_EMAIL. */
  readonly RER_DEMO?: string
  readonly OWNER_EMAIL?: string
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
