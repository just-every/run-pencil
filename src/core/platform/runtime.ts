import { createDatabase, type PencilDatabase } from './db/repository'
import { createD1BatchExecutor, type D1BatchExecutor } from './db/batch'
import { readRuntimeConfiguration, type RuntimeConfiguration } from './config/runtime'
import type { WorkerBindings } from '../app/environment'
import { readManagementConfiguration, type ManagementConfiguration } from './management'
import { deploymentHealth } from '../../base/deployment-health'
import { readAiProvider, type AiProvider } from './ai/provider'

export type PencilPlatform = {
  readonly database: PencilDatabase
  readonly databaseBinding: D1Database
  readonly databaseBatch: D1BatchExecutor
  readonly configuration: RuntimeConfiguration
  readonly management: ManagementConfiguration
  /** Which deployment answers: the identity rer deploy binds and reads back from /health. */
  readonly deployment: ReturnType<typeof deploymentHealth>
  fetchAsset(request: Request): Promise<Response>
  /** ai.provider.v1 for analysis: off until configured (WS-003); a local runtime uses the dev client server.dev.ts supplies. */
  readonly ai: AiProvider
}

export function createPencilPlatform(requestUrl: string, environment: WorkerBindings): PencilPlatform {
  const configuration = readRuntimeConfiguration(requestUrl, environment)
  return {
    database: createDatabase(environment.DB),
    databaseBinding: environment.DB,
    databaseBatch: createD1BatchExecutor(environment.DB),
    configuration,
    management: readManagementConfiguration(environment),
    deployment: deploymentHealth(environment),
    fetchAsset: (request) => environment.ASSETS.fetch(request),
    ai: readAiProvider(environment, configuration.isLocalDevelopment),
  }
}

export function createRequestPlatform(context: { req: { url: string }; env: WorkerBindings }) {
  return createPencilPlatform(context.req.url, context.env)
}

export function createScheduledPencilPlatform(environment: WorkerBindings): PencilPlatform {
  return createPencilPlatform(environment.APP_ORIGIN ?? 'http://localhost', environment)
}
