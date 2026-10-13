import { createDatabase, type PencilDatabase } from './db/repository'
import { createD1BatchExecutor, type D1BatchExecutor } from './db/batch'
import { readRuntimeConfiguration, type RuntimeConfiguration } from './config/runtime'
import type { WorkerBindings } from '../app/environment'
import { readManagementConfiguration, type ManagementConfiguration } from './management'
import { developmentOutboxResponse } from './mail/development.server'
import { deploymentHealth } from '../../base/deployment-health'

export type PencilPlatform = {
  readonly database: PencilDatabase
  readonly databaseBinding: D1Database
  readonly databaseBatch: D1BatchExecutor
  readonly configuration: RuntimeConfiguration
  readonly management: ManagementConfiguration
  /** Which deployment answers: the identity rer deploy binds and reads back from /health. */
  readonly deployment: ReturnType<typeof deploymentHealth>
  fetchAsset(request: Request): Promise<Response>
  /** The key-gated local outbox and key exchange (`/__dev/outbox`, `/__dev/key`): 404 unless a local runtime holds RER_DEV_KEY. */
  developmentOutbox(request: Request): Promise<Response>
}

export function createPencilPlatform(requestUrl: string, environment: WorkerBindings): PencilPlatform {
  return {
    database: createDatabase(environment.DB),
    databaseBinding: environment.DB,
    databaseBatch: createD1BatchExecutor(environment.DB),
    configuration: readRuntimeConfiguration(requestUrl, environment),
    management: readManagementConfiguration(environment),
    deployment: deploymentHealth(environment),
    fetchAsset: (request) => environment.ASSETS.fetch(request),
    developmentOutbox: (request) => developmentOutboxResponse(request, environment, environment.DB),
  }
}

export function createRequestPlatform(context: { req: { url: string }; env: WorkerBindings }) {
  return createPencilPlatform(context.req.url, context.env)
}

export function createScheduledPencilPlatform(environment: WorkerBindings): PencilPlatform {
  return createPencilPlatform(environment.APP_ORIGIN ?? 'http://localhost', environment)
}
