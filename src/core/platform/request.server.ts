import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'
import type { WorkerBindings } from '../app/environment'
import { initializePencil } from '../app/worker'
import { createPencilPlatform } from './runtime'

export async function requestServices() {
  const request = getRequest()
  const platform = createPencilPlatform(request.url, env as unknown as WorkerBindings)
  return { request, platform, services: await initializePencil(platform) }
}
