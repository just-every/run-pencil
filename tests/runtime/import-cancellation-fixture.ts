import { env } from 'cloudflare:test'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { hashToken, opaqueToken } from '../../src/base/operator-auth/crypto.mjs'
import type { ImportActor } from '../../src/core/features/importing/service'

/** Change only scheduling; every query, guard and HTTP handler is real. */
export function cancellationRace(when: 'before-select' | 'after-select', action: () => Promise<void>) {
  const observed = { selected: false, atomicGuard: false }
  const track = (statement: D1PreparedStatement, query: string): D1PreparedStatement => new Proxy(statement, { get(target, key) {
    if (key === 'bind') return (...values: unknown[]) => track(target.bind(...values), query)
    if (key === 'first') return async (...args: unknown[]) => {
      if (!observed.selected && query.startsWith('SELECT * FROM ik_d1_staging WHERE destination=? AND namespace=? AND principal_id=? AND operation_key=?')) {
        observed.selected = true
        if (when === 'before-select') await action()
        const row = await target.first(...args as [])
        if (when === 'after-select') await action()
        return row
      }
      return target.first(...args as [])
    }
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
  } })
  const database = new Proxy(env.DB, { get(target, key) {
    if (key === 'prepare') return (query: string) => track(target.prepare(query), query)
    if (key === 'batch') return async (statements: D1PreparedStatement[]) => {
      try { return await target.batch(statements) }
      catch (error) { if (error instanceof Error && /IMPORT_ATOMIC_GUARD/.test(error.message)) observed.atomicGuard = true; throw error }
    }
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
  } })
  return { database, observed }
}

export async function cancellationHttp(database: D1Database, actor: ImportActor) {
  const token = opaqueToken()
  await env.DB.prepare('UPDATE oa_sessions SET token_hash=? WHERE id=?').bind(await hashToken(env.SESSION_SECRET, 'session', token), actor.id).run()
  const app = createWorkerApp(undefined, createPencilPlatform('http://localhost', { ...env, DB: database }))
  return (path: string, body: object = {}) => app.request(`http://localhost/api/app/imports${path}`, { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', Cookie: `operator_session_local=${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
