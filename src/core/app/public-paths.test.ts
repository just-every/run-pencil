import { expect, it, vi } from 'vitest'
import manifest from '../../../seed.json'
import { RateLimitError } from '../shared/errors'
import type { PencilServices } from './services'
import { isDeclaredPublicPath, publicRequestRateLimitResponse } from './public-paths'

it('matches exactly every declared public surface, with root literal and prefixes bounded by slash', () => {
  for (const path of manifest.deploy.publicPaths) {
    expect(isDeclaredPublicPath(path)).toBe(true)
    if (path !== '/' && path.endsWith('/')) {
      const stem = path.slice(0, -1)
      expect(isDeclaredPublicPath(`${path}nested/path`)).toBe(true)
      // A prefix never admits its bare stem; the stem is public only when declared exact itself (`/docs` beside `/docs/`).
      expect(isDeclaredPublicPath(stem)).toBe(manifest.deploy.publicPaths.includes(stem))
    } else expect(isDeclaredPublicPath(`${path}suffix`)).toBe(false)
  }
  for (const path of ['/app', '/app/settings', '/api/app/flows', '/health-extra', '/signinfoo', '/f-other/slug', '/_serverFn-other/id', '/no-such-path']) expect(isDeclaredPublicPath(path)).toBe(false)
})

it('denies declared paths before dispatch and excludes private documents; unexpected failures propagate', async () => {
  const enforcePublicRequestRateLimit = vi.fn().mockRejectedValue(new RateLimitError())
  const responses = { enforcePublicRequestRateLimit } as unknown as PencilServices['responses']
  for (const path of manifest.deploy.publicPaths) {
    const response = await publicRequestRateLimitResponse(new Request(`https://pencil.test${path}`, { headers: { 'CF-Connecting-IP': '198.18.1.1' } }), responses)
    expect(response?.status).toBe(429)
    expect(response?.headers.get('Cache-Control')).toBe('no-store')
    expect(await response?.json()).toEqual({ error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute and try again.' })
  }
  expect(enforcePublicRequestRateLimit).toHaveBeenCalledTimes(manifest.deploy.publicPaths.length)
  expect(await publicRequestRateLimitResponse(new Request('https://pencil.test/app'), responses)).toBeUndefined()
  expect(enforcePublicRequestRateLimit).toHaveBeenCalledTimes(manifest.deploy.publicPaths.length)
  enforcePublicRequestRateLimit.mockRejectedValueOnce(new Error('synthetic database failure'))
  await expect(publicRequestRateLimitResponse(new Request('https://pencil.test/health'), responses)).rejects.toThrow('synthetic database failure')
})
