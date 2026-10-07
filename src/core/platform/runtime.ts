import { createDatabase, type PencilDatabase } from './db/repository'
import { createD1BatchExecutor, type D1BatchExecutor } from './db/batch'
import { readRuntimeConfiguration, type RuntimeConfiguration } from './config/runtime'
import type { WorkerBindings } from '../app/environment'

export type PencilPlatform = {
  readonly database: PencilDatabase
  readonly databaseBinding: D1Database
  readonly databaseBatch: D1BatchExecutor
  readonly configuration: RuntimeConfiguration
  fetchAsset(request: Request): Promise<Response>
}

export function createPencilPlatform(requestUrl: string, environment: WorkerBindings): PencilPlatform {
  return {
    database: createDatabase(environment.DB),
    databaseBinding: environment.DB,
    databaseBatch: createD1BatchExecutor(environment.DB),
    configuration: readRuntimeConfiguration(requestUrl, environment),
    fetchAsset: (request) => environment.ASSETS.fetch(request),
  }
}

export function createRequestPlatform(context: { req: { url: string }; env: WorkerBindings }) {
  return createPencilPlatform(context.req.url, context.env)
}

export function createScheduledPencilPlatform(environment: WorkerBindings): PencilPlatform {
  return createPencilPlatform(environment.APP_ORIGIN ?? 'http://localhost', environment)
}
