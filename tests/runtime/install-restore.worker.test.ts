import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import type { WorkerBindings } from '../../src/core/app/environment'
import { insertStatement, readStatement, restoreStatements, schemaQuery, ledger, quote } from '../../scripts/deployment-data-sql.mjs'
import { initializedTable } from '../../scripts/deployment-data-initialized.mjs'
import { sanitize } from '../../scripts/deployment-data-policy.mjs'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const origin = 'https://pencil.example.test'
const secret = 'synthetic-restoration-secret-at-least-32-characters'
const setup = 'synthetic-restoration-setup-at-least-32-characters'
const bindings = { ...env, APP_ORIGIN: origin, SESSION_SECRET: secret, SETUP_TOKEN: setup,
  SEED_ADMIN_EMAIL: 'operator@example.test', MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'synthetic-provider-credential',
  MAIL_FROM: 'sender@example.test', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' } as WorkerBindings
const run = (path: string, body?: unknown, cookie?: string) => worker.fetch(new Request(origin + path, {
  method: body === undefined ? 'GET' : 'POST', headers: { Host: 'pencil.example.test', Origin: origin, 'CF-Connecting-IP': '192.0.2.73', 'Content-Type': 'application/json', ...(cookie ? {Cookie:cookie} : {}) },
  ...(body === undefined ? {} : {body:JSON.stringify(body)}),
}), bindings, {} as ExecutionContext)
type Cell = {type:string;value?:string|number;hex?:string}
type Table = {name:string;columns:string[];rows:Cell[][]}
const toHex = (base64: string) => [...atob(base64)].map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join('')
async function archiveSnapshot() {
  const schema = (await env.DB.prepare(schemaQuery).all()).results as Array<{type:string;name:string;sql:string}>
  const tables = await Promise.all(schema.filter(row=>row.type==='table').sort((a,b)=>a.name.localeCompare(b.name)).map(async row => ({
    name:row.name, columns:(await env.DB.prepare(`PRAGMA table_xinfo(${quote(row.name)})`).all<{name:string;hidden:number}>()).results.filter(column=>column.hidden===0).map(column=>column.name),
  })))
  const descriptors=[ledger,...tables]
  const result=await env.DB.batch(descriptors.map(table=>env.DB.prepare(readStatement(table).sql)))
  const records=descriptors.map((table,index)=>({ ...table, rows:result[index].results.map(row=>JSON.parse(String(row.cells)).map((cell:Cell)=>cell.type==='blob'?{type:'blob',value:btoa(String(cell.hex).match(/../g)?.map(hex=>String.fromCharCode(parseInt(hex,16))).join('')??'')}:cell)) })) as Table[]
  return {payload:{schema:JSON.stringify(schema),migrations:__PENCIL_CORE_MIGRATIONS__.map(row=>({name:row.name})),d1Migrations:records[0],tables:records.slice(1).map(sanitize)}}
}
contract(['DATA-001','BASE-DATA-001','BASE-ACCESS-001','BASE-OPS-003'], 'real D1 restores an empty install with unchanged delivery facts, no mail, working sign-in and an unreclaimable bootstrap', async () => {
  const send=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:202,headers:{'X-Message-Id':'synthetic-delivery'}}))
  try {
    const bootstrap=await run('/auth/bootstrap',{token:setup,displayName:'Original owner'})
    expect(bootstrap.status).toBe(303)
    const cookie=bootstrap.headers.get('set-cookie')!.split(';')[0]
    await env.DB.prepare('INSERT INTO local_mail_outbox(delivery_id,message_json,created_at) VALUES(?,?,?)').bind('captured',JSON.stringify({token:'planted-private-link'}),new Date().toISOString()).run()
    const stamp = new Date().toISOString()
    const workspace = await env.DB.prepare('SELECT id FROM workspaces').first<{id:string}>()
    await env.DB.prepare('INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?,?)').bind('restore-flow',workspace!.id,'restore-flow','Recovered form','closed',stamp,stamp,stamp).run()
    await env.DB.prepare('INSERT INTO flow_revisions(id,flow_id,number,state,title,created_at,updated_at) VALUES(?,?,1,?,?,?,?)').bind('restore-revision','restore-flow','published','Recovered form',stamp,stamp).run()
    await env.DB.prepare('INSERT INTO invitation_launches(id,workspace_id,revision_id,command_key,policy_json,created_at) VALUES(?,?,?,?,?,?)').bind('restore-launch',workspace!.id,'restore-revision','restore-command','{}',stamp).run()
    for (const status of ['sent','failed','unknown']) {
      await env.DB.prepare('INSERT INTO invitation_participants(id,launch_id,workspace_id,revision_id,token,opt_out_token,delivery_status,response_status,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(`participant-${status}`,'restore-launch',workspace!.id,'restore-revision',`private-invitation-${status}`,`private-optout-${status}`,status,'not-started',stamp).run()
      await env.DB.prepare('INSERT INTO mail_deliveries(id,participant_id,kind,status,idempotency_key,available_at,attempts,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)').bind(`delivery-${status}`,`participant-${status}`,'invitation',status,`restore:${status}`,stamp,stamp,stamp).run()
    }
    const operator=await env.DB.prepare('SELECT id FROM operators').first<{id:string}>()
    await env.DB.prepare('INSERT INTO notification_preferences(flow_id,operator_id,mode,updated_at) VALUES(?,?,?,?)').bind('restore-flow',operator!.id,'immediately',stamp).run()
    for (const status of ['pending','sent','failed','unknown']) {
      await env.DB.prepare('INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,completed_at,created_at,updated_at,notification_eligible) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)').bind(`notification-response-${status}`,workspace!.id,'restore-flow','restore-revision',`receipt-session-${status}`,`hash-${status}`,`receipt-${status}`,'released',stamp,stamp,stamp).run()
      await env.DB.prepare('INSERT INTO notification_deliveries(id,response_id,operator_id,status,idempotency_key,attempts,available_at,provider,provider_code,created_at,updated_at) VALUES(?,?,?,?,?,2,?,?,?,?,?)').bind(`notification-${status}`,`notification-response-${status}`,operator!.id,status,`notification-key-${status}`,stamp,'sendgrid','RATE_LIMITED',stamp,stamp).run()
      await env.DB.prepare('INSERT INTO notification_attempts(id,delivery_id,ordinal,event,provider,provider_code,created_at) VALUES(?,?,2,?,?,?,?)').bind(`notification-attempt-${status}`,`notification-${status}`,status,'sendgrid','RATE_LIMITED',stamp).run()
    }
    const archive=await archiveSnapshot()
    expect(JSON.stringify(archive)).not.toContain('planted-private-link')
    expect(JSON.stringify(archive)).not.toContain('private-invitation-')
    expect(JSON.stringify(archive)).not.toContain('private-optout-')
    const trustedSchema=JSON.parse(archive.payload.schema) as Array<{type:string;name:string;sql:string}>
    const triggers=trustedSchema.filter(row=>row.type==='trigger')
    // This fixture creates a genuinely empty migrated destination, then executes
    // the production restore planner on the native D1 binding.
    await env.DB.batch([
      env.DB.prepare('PRAGMA defer_foreign_keys = ON'),
      ...triggers.map(row=>env.DB.prepare(`DROP TRIGGER ${quote(row.name)}`)),
      ...archive.payload.tables.map((table:Table)=>env.DB.prepare(`DELETE FROM ${quote(table.name)}`)),
      ...archive.payload.tables.flatMap((table:Table)=>initializedTable(table).rows.map((row:Cell[])=>{
        const statement=insertStatement(table,row,toHex)
        return env.DB.prepare(statement.sql).bind(...statement.params)
      })),
      ...triggers.map(row=>env.DB.prepare(row.sql)),
    ])
    const statements=restoreStatements(archive,trustedSchema,toHex)
    await env.DB.batch(statements.map(({sql,params=[]}:{sql:string;params?:unknown[]})=>env.DB.prepare(sql).bind(...params)))
    expect(await archiveSnapshot()).toEqual(archive)
    expect(send).not.toHaveBeenCalled()
    await worker.scheduled({scheduledTime:Date.now()} as ScheduledController, bindings)
    expect(send).not.toHaveBeenCalled()
    expect((await env.DB.prepare('SELECT status,attempts FROM mail_deliveries ORDER BY status').all()).results).toEqual([{status:'failed',attempts:1},{status:'sent',attempts:1},{status:'unknown',attempts:1}])
    expect((await env.DB.prepare('SELECT status,attempts,provider,provider_code FROM notification_deliveries ORDER BY status').all()).results).toEqual(['failed','pending','sent','unknown'].map(status=>({status,attempts:2,provider:'sendgrid',provider_code:'RATE_LIMITED'})))
    expect(await env.DB.prepare('SELECT count(*) n FROM notification_attempts').first()).toEqual({n:4})
    const afterMaintenance=await archiveSnapshot()
    // Both schema and nonempty guards run before writes, even on direct batches.
    await expect(env.DB.batch(statements.map(({sql,params=[]}:{sql:string;params?:unknown[]})=>env.DB.prepare(sql).bind(...params)))).rejects.toThrow()
    expect(await archiveSnapshot()).toEqual(afterMaintenance)
    // Sessions never travel: the owner's pre-backup cookie is refused and everyone signs in again.
    expect((await run('/api/app/dashboard',undefined,cookie)).status).toBe(401)
    expect((await run('/auth/bootstrap',{token:setup,displayName:'Second owner'})).status).toBe(409)
    expect((await run('/auth/magic-link',{email:'operator@example.test'})).status).toBe(202)
    expect(send).toHaveBeenCalledTimes(1)
    const payload=JSON.parse(String(send.mock.calls[0][1]!.body))
    const link=payload.content.find((item:{type:string})=>item.type==='text/plain').value.match(/https[^\s]+/)[0]
    const response=await run('/auth/confirm',{token:new URL(link).searchParams.get('token')})
    expect(response.status).toBe(303)
    expect((await run('/api/app/dashboard',undefined,response.headers.get('set-cookie')!.split(';')[0])).status).toBe(200)
    expect(await env.DB.prepare('SELECT count(*) n FROM oa_operators').first()).toEqual({n:1})
  } finally {send.mockRestore()}
})
