import { appHeaders } from './api-headers'
import { contract } from './contract'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { openStateDatabase } from './state-database'
import type { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import manifest from '../../seed.json' with { type: 'json' }
import { expect, test } from './fixtures'

const emitted = !process.env.PENCIL_MIGRATION_DEV
const directory = process.env.PENCIL_MIGRATION_STATE ?? '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
function database() { return openStateDatabase(join(directory, readdirSync(directory).find(name => name.endsWith('.sqlite'))!)) }
function seedWindow(db: DatabaseSync, address: string, count: number) {
  const hash = createHash('sha256').update(`public-rate:${address}`).digest('hex')
  const minute = Math.floor(Date.now() / 60000) * 60000
  // Seed adjacent windows so the assertion remains correct across a minute edge.
  for (const start of [minute, minute + 60000]) {
    const began = new Date(start).toISOString(); const expires = new Date(start + 60000).toISOString()
    db.prepare(`INSERT INTO public_rate_limit_windows (id, scope, address_hash, window_started_at, count, expires_at, created_at, updated_at)
      VALUES (?, 'request', ?, ?, ?, ?, ?, ?) ON CONFLICT(scope,address_hash,window_started_at) DO UPDATE SET count=excluded.count,expires_at=excluded.expires_at`).run(`rate-request-${hash}-${began}`, hash, began, count, expires, began, began)
  }
  return hash
}

contract(["BASE-ACCESS-003","RESP-015"], "public request and final submission limits refuse excess traffic without retaining invalid answers and recover after expiry", async ({ request }, info) => {
  await test.step("every declared native public surface shares actual 429 enforcement and an expired window recovers", async () => {
    test.skip(!emitted, 'Requires emitted dispatcher and its declared D1 state.')
    const db = database();
    const hashes: string[] = []
    try {
    // Keep the concrete logo workload even though the public API prefix covers it.
    const publicSurfaces = [...new Set([...manifest.deploy.publicPaths, '/api/public/brand/logo'])]
    for (const [index, path] of publicSurfaces.entries()) {
      const address = `198.18.${info.project.name === 'mobile' ? 157 : 156}.${100 + index}`
      const hash = seedWindow(db, address, manifest.limits.publicRateLimits.requestsPerIpPerMinute)
      hashes.push(hash)
      const response = await request.get(path !== '/' && path.endsWith('/') ? `${path}rate-proof-missing` : path, { headers: { 'CF-Connecting-IP': address }, maxRedirects: 0 })
      expect(response.status(), path).toBe(429)
      expect(response.headers()['cache-control']).toBe('no-store')
      expect(await response.json()).toEqual({ error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute and try again.' })
      expect(db.prepare("SELECT MAX(count) AS n FROM public_rate_limit_windows WHERE scope='request' AND address_hash=?").get(hash)).toMatchObject({ n: manifest.limits.publicRateLimits.requestsPerIpPerMinute })
      const retained = db.prepare('SELECT * FROM public_rate_limit_windows WHERE address_hash=?').all(hash)
      expect(JSON.stringify(retained)).not.toContain(address)
    }
    const address = `198.18.${info.project.name === 'mobile' ? 157 : 156}.200`
    const hash = seedWindow(db, address, manifest.limits.publicRateLimits.requestsPerIpPerMinute - 1); hashes.push(hash)
    const code = readdirSync('dist/server/assets').find(name => name.includes('server-fn-resolver'))!
    const resolver = readFileSync(join('dist/server/assets', code), 'utf8')
    const id = resolver.match(/"([a-f0-9]{64})": \{\s*functionName: "loadPublicConfig_createServerFn_handler"/)?.[1]
    expect(id).toBeTruthy()
    expect((await request.get('/health', { headers: { 'CF-Connecting-IP': address } })).status()).toBe(200)
    const origin = new URL(process.env.PENCIL_E2E_BASE_URL ?? 'http://127.0.0.1:4173').origin
    const headers = { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'CF-Connecting-IP': address, 'x-tsr-serverFn': 'true', Accept: 'application/json' }
    let denied = await request.get(`/_serverFn/${id}`, { headers })
    if (denied.status() === 200) {
      // A genuine minute transition renews admission. Both independently
      // seeded windows must now be full before the following refusal.
      expect(db.prepare('SELECT count FROM public_rate_limit_windows WHERE address_hash=? ORDER BY window_started_at').all(hash)).toEqual([{ count: manifest.limits.publicRateLimits.requestsPerIpPerMinute }, { count: manifest.limits.publicRateLimits.requestsPerIpPerMinute }])
      denied = await request.get(`/_serverFn/${id}`, { headers })
    }
    expect(denied.status()).toBe(429)
    expect(await denied.json()).toMatchObject({ error: 'RATE_LIMITED' })
    db.prepare('UPDATE public_rate_limit_windows SET expires_at=? WHERE address_hash=?').run('2000-01-01T00:00:00.000Z', hash)
    const recovered = await request.get(`/_serverFn/${id}`, { headers })
    expect(recovered.status()).toBe(200)
    expect(recovered.headers()['x-tss-serialized']).toBe('true')
    expect(db.prepare("SELECT count FROM public_rate_limit_windows WHERE scope='request' AND address_hash=?").all(hash)).toEqual([{ count: 1 }])
  } finally {
    for (const hash of hashes) db.prepare('DELETE FROM public_rate_limit_windows WHERE address_hash=?').run(hash)
    db.close()
  }
  });
  await test.step("final submissions enforce the manifest cap without saving refused or invalid answers", async () => {
    test.skip(!emitted, 'Requires emitted runtime and its declared D1 state.')
    const db = database()
    const address = `198.18.${info.project.name === 'mobile' ? 157 : 156}.220`
    const hash = createHash('sha256').update(`public-rate:${address}`).digest('hex')
    const before = db.prepare('SELECT COUNT(*) AS n FROM responses').get()
    try {
    const began = Math.floor(Date.now() / 60000) * 60000
    for (const start of [began, began + 60000]) {
      const date = new Date(start).toISOString()
      db.prepare("INSERT INTO public_rate_limit_windows (id,scope,address_hash,window_started_at,count,expires_at,created_at,updated_at) VALUES (?, 'submission', ?, ?, ?, ?, ?, ?)").run(`rate-submission-${hash}-${date}`, hash, date, manifest.limits.publicRateLimits.finalSubmissionsPerIpPerMinute - 1, new Date(start + 60000).toISOString(), date, date)
    }
    const input = { headers: { ...appHeaders, 'CF-Connecting-IP': address }, data: { sessionId: 'synthetic-absent-rate-session', sessionToken: 'x'.repeat(64), answers: [], idempotencyKey: 'synthetic-rate-final-submit' } }
    expect((await request.post('/api/public/flows/aurora-coffee-post-visit/responses', input)).status()).toBe(400)
    let denied = await request.post('/api/public/flows/aurora-coffee-post-visit/responses', input)
    if (denied.status() === 400) {
      expect(db.prepare("SELECT count FROM public_rate_limit_windows WHERE scope='submission' AND address_hash=? ORDER BY window_started_at").all(hash)).toEqual([{ count: manifest.limits.publicRateLimits.finalSubmissionsPerIpPerMinute }, { count: manifest.limits.publicRateLimits.finalSubmissionsPerIpPerMinute }])
      denied = await request.post('/api/public/flows/aurora-coffee-post-visit/responses', input)
    }
    expect(denied.status()).toBe(429)
    expect(await denied.json()).toMatchObject({ error: 'RATE_LIMITED' })
    expect(db.prepare('SELECT COUNT(*) AS n FROM responses').get()).toEqual(before)
  } finally { db.prepare('DELETE FROM public_rate_limit_windows WHERE address_hash=?').run(hash); db.close() }
  });
})
