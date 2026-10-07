import type { Context } from 'hono'
import type { WorkerEnvironment } from './environment'
import type { PencilServices } from './services'
import type { RuntimeConfiguration } from '../platform/config/runtime'

export type RequestServices = (context: Context<WorkerEnvironment>) => PencilServices
export type RequestConfiguration = (context: Context<WorkerEnvironment>) => RuntimeConfiguration
