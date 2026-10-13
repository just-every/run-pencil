import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { hashToken, opaqueToken } from '../../src/base/operator-auth/crypto.mjs'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import type { ImportInput, ImportReview } from '../../src/core/features/importing/model'
export type ImportJob = { id: string; state: string; checkpoint: number; total: number }
export async function googleHttp(workspace = crypto.randomUUID()) {
  const operatorId = crypto.randomUUID(), sessionId = crypto.randomUUID(), token = opaqueToken(), now = new Date().toISOString()
  await env.DB.prepare("INSERT OR IGNORE INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES(?,'Google route proof','UTC','09:00','17:00',?,?)").bind(workspace, now, now).run()
  await env.DB.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,'Route importer',0,?,?)").bind(operatorId, workspace, `${operatorId}@example.test`, now, now).run()
  await env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,1,'native',?,?)").bind(sessionId, await hashToken(env.SESSION_SECRET, 'session', token), operatorId, Date.now(), Date.now() + 3600000).run()
  const app = createWorkerApp(undefined, createPencilPlatform('http://localhost', env))
  const call = (path: string, body?: unknown, options: { auth?: boolean; method?: string; accept?: string; origin?: string } = {}) => app.request(`http://localhost${path}`, { method: options.method ?? (body === undefined ? 'GET' : 'POST'), headers: { Host: 'localhost', Origin: options.origin ?? 'http://localhost', Cookie: options.auth === false ? '' : `operator_session_local_80=${token}`, 'Content-Type': 'application/json', ...(options.accept ? { Accept: options.accept } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const review = async (input: ImportInput) => { const response = await call('/api/app/imports/review', input); expect(response.status, await response.clone().text()).toBe(200); return response.json() as Promise<ImportReview> }
  const finish = async (job: ImportJob, state = 'completed') => {
    for (let attempt = 0; job.state !== state && attempt < 30; attempt++) { const response = await call(`/api/app/imports/${job.id}/resume`, {}); expect(response.status, await response.clone().text()).toBe(200); job = await response.json() }
    expect(job.state).toBe(state); return job
  }
  const commit = async (input: ImportInput, reviewed?: ImportReview) => { const report = reviewed ?? await review(input); expect(report.rowErrors).toEqual([]); const response = await call('/api/app/imports/commit', { ...input, columns: report.columns, plannedAt: report.plannedAt, fingerprint: report.fingerprint, acknowledged: true }); expect(response.status, await response.clone().text()).toBe(200); return { report, job: await finish(await response.json()) } }
  expect((await call('/health')).status).toBe(200)
  return { workspace, operatorId, sessionId, call, review, finish, commit }
}
export async function counts() {
  const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{ name: string }>()).results
  return Object.fromEntries(await Promise.all(tables.map(async ({ name }) => [name, (await env.DB.prepare(`SELECT COUNT(*) AS n FROM "${name.replaceAll('"', '""')}"`).first<{ n: number }>())!.n])))
}
