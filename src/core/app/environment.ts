import type { PencilServices } from './services'
import type { PencilPlatform } from '../platform/runtime'

export interface WorkerBindings {
  readonly ASSETS: Fetcher
  readonly DB: D1Database
  readonly APP_ORIGIN?: string
  readonly PENCIL_BUILD_ID?: string
  readonly SEED_ADMIN_EMAIL?: string
  readonly SEED_SAMPLE_DATA?: string
  readonly MAIL_PROVIDER?: string
  readonly MAIL_API_KEY?: string
  readonly MAIL_FROM?: string
  readonly SESSION_SECRET?: string
  readonly SETUP_TOKEN?: string
  readonly PENCIL_LOCAL_DEVELOPMENT?: string
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
