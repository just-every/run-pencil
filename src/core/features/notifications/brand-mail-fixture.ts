import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { sqliteD1 } from '../../../../tests/helpers/sqlite-d1'
import { createPencilPlatform } from '../../platform/runtime'
import { createPencilServices } from '../../app/services'
import type { WorkerBindings } from '../../app/environment'
export const now = '2026-10-08T00:00:00.000Z'
export const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=', 'base64'))
export const jpeg = Uint8Array.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217])
export const webp = Uint8Array.from([82,73,70,70,12,0,0,0,87,69,66,80,86,80,56,76,0,0,0,0])

/** Real migrations and SQLite; the D1 raw extension supports Drizzle's row arrays. */
export function brandMailFixture() {
  const sql = new DatabaseSync(':memory:')
  for (const file of readdirSync('migrations/core').filter(file => file.endsWith('.sql')).sort()) sql.exec(readFileSync(`migrations/core/${file}`, 'utf8'))
  const base = sqliteD1(sql)
  let reads = 0
  const db = { ...base, prepare(query: string) {
    if (query.includes('brand_logo_base64 AS logoBase64')) reads++
    const statement = base.prepare(query), bind = statement.bind.bind(statement)
    let values: unknown[] = []
    Object.assign(statement, { bind(...args: unknown[]) { values = args; bind(...args); return statement }, async raw() {
      const prepared = sql.prepare(query); prepared.setReturnArrays(true)
      return prepared.all(...values as [])
    } })
    return statement
  } } as unknown as D1Database
  const platform = createPencilPlatform('https://forms.example.test', {
    DB: db, APP_ORIGIN: 'https://forms.example.test', PENCIL_BUILD_ID: 'test', SEED_ADMIN_EMAIL: 'operator@example.test',
    MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'synthetic-test-key', MAIL_FROM: 'no-reply@example.test', SESSION_SECRET: 'synthetic-test-session-secret-long-enough',
  } as WorkerBindings)
  const services = createPencilServices(platform)
  function workspace(id = 'business') {
    sql.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)').run(id, 'Unconfigured workspace title', 'Australia/Brisbane', now, now)
    sql.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id, id, `${id}@example.test`, 'Operator', now, now)
    sql.prepare("INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES(?,?,?,'Feedback','open',1,?,?,?)").run(id, id, id, now, now, now)
    sql.prepare("INSERT INTO flow_revisions(id,flow_id,number,state,title,created_at,updated_at) VALUES(?,?,1,'published','Feedback',?,?)").run(id, id, now, now)
    sql.prepare("INSERT INTO notification_preferences(flow_id,operator_id,mode,updated_at) VALUES(?,?,'immediately',?)").run(id, id, now)
  }
  function response(id: string, workspaceId = 'business') {
    sql.prepare("INSERT INTO respondent_sessions(id,revision_id,source,device_class,expires_at,created_at,updated_at) VALUES(?,?,'direct','desktop',?,?,?)").run(id, workspaceId, now, now, now)
    sql.prepare("INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,completed_at,created_at,updated_at,source,state,notification_eligible) VALUES(?,?,?,?,?,?,?,?,?,?,'direct','released',1)").run(id, workspaceId, workspaceId, workspaceId, id, id, id, now, now, now)
    sql.prepare("INSERT INTO response_outbox(id,response_id,workspace_id,idempotency_key,kind,status,payload_json,available_at,created_at,updated_at,notification_eligible) VALUES(?,?,?,?,'response.completed','pending',?,?,?,?,1)").run(id, id, workspaceId, id, JSON.stringify({ notificationOperatorIds: [workspaceId] }), now, now, now)
  }
  return { sql, db, services, workspace, response, brandReads: () => reads }
}
