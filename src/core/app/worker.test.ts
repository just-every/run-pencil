import { describe, expect, it, vi } from 'vitest'
import type { PencilPlatform } from '../platform/runtime'
import type { PencilServices } from './services'
import { createWorkerApp } from './worker'

function unauthenticatedServices() {
  return { auth: { getSession: vi.fn().mockResolvedValue(undefined) } } as unknown as PencilServices
}

function platform() {
  return {
    configuration: {
      appOrigin: 'https://pencil.test',
      buildId: 'test-build',
      mail: { kind: 'resend', apiKey: 'test', from: 'no-reply@pencil.test' },
      isLocalDevelopment: false,
      seedSampleData: false,
    },
    fetchAsset: vi.fn(),
  } as unknown as PencilPlatform
}

function publicRequestServices() {
  return {
    auth: { getSession: vi.fn().mockResolvedValue(undefined) },
    responses: { enforcePublicRequestRateLimit: vi.fn().mockResolvedValue(undefined) },
    workspace: { checkHealth: vi.fn().mockResolvedValue(undefined) },
  } as unknown as PencilServices
}

describe('Pencil Worker session boundary', () => {
  it('redirects an unauthenticated operator document to sign in', async () => {
    const app = createWorkerApp(unauthenticatedServices(), platform())
    const response = await app.request('https://pencil.test/app', { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('/signin?returnTo=%2Fapp')
  })

  it.each(['/api/app', '/api/app/flows'])('never serves an operator API without a session at %s', async (path) => {
    const app = createWorkerApp(unauthenticatedServices(), platform())
    const response = await app.request(`https://pencil.test${path}`)
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'AUTHENTICATION_REQUIRED' })
  })

  it('limits each declared public path before serving its route or asset', async () => {
    const services = publicRequestServices()
    const app = createWorkerApp(services, platform())

    await app.request('https://pencil.test/health', { headers: { 'CF-Connecting-IP': '198.51.100.22' } })
    await app.request('https://pencil.test/assets/application.js', { headers: { 'CF-Connecting-IP': '198.51.100.22' } })

    expect(services.responses.enforcePublicRequestRateLimit).toHaveBeenCalledTimes(2)
    expect(services.responses.enforcePublicRequestRateLimit).toHaveBeenLastCalledWith({
      clientAddress: '198.51.100.22',
      scope: 'request',
    })
  })

  it('identifies the product and exact build after a D1 health check', async () => {
    const app = createWorkerApp(publicRequestServices(), platform())
    const response = await app.request('https://pencil.test/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok', product: 'pencil', version: '0.1.0', buildId: 'test-build' })
  })

  it('rejects an operator cookie mutation that lacks its exact Origin header', async () => {
    const services = {
      auth: { getSession: vi.fn().mockResolvedValue({ workspaceId: 'workspace', operatorId: 'operator' }) },
    } as unknown as PencilServices
    const app = createWorkerApp(services, platform())

    const response = await app.request('https://pencil.test/api/app/operators', { method: 'POST' })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'FORBIDDEN' })
  })
})
