
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { archiveFixture, restoreFixture } from './archive-fixture'
import { stagingPlan, destinationGuards, stageRows, cleanupStage } from '../../scripts/deployment-data-staging.mjs'
import { pageStatement } from '../../scripts/deployment-data-page.mjs'
import { canonicalSchema } from '../../scripts/deployment-data-schema.mjs'
import { schemaQuery, quote, insertStatement } from '../../scripts/deployment-data-sql.mjs'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
type Statement = { sql: string; params?: unknown[] }
const query = (batch: Statement[]) => env.DB.batch(batch.map(({ sql, params = [] }) => env.DB.prepare(sql).bind(...params)))

contract(['DATA-001','BASE-DATA-001','BASE-OPS-003','PAY-001'], 'native D1 stages bounded writes and atomically publishes all tables, payment states and Stripe IDs included, with exact constraints and concurrent-writer refusal', async () => {
  const empty = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  const stamp = '2026-10-01T00:00:00Z'
  const exact = '😀\u0000"\\\n'.repeat(600)
  await env.DB.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at,brand_logo_base64) VALUES(?,?,?,?,?,?)').bind('workspace','Restore','UTC',stamp,stamp,'a'.repeat(349_524)).run()
  await env.DB.prepare('INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?,?)').bind('flow','workspace','recovery','Recovery','closed',stamp,stamp,stamp).run()
  await env.DB.prepare('INSERT INTO flow_revisions(id,flow_id,number,state,title,created_at,updated_at) VALUES(?,?,1,?,?,?,?)').bind('revision','flow','published','Recovery',stamp,stamp).run()
  for(let index=0;index<26;index++)await env.DB.prepare('INSERT INTO flow_steps(id,revision_id,position,kind,question_type,prompt,required,stable_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(`step-${index}`,'revision',index,'question','long_text','Question',1,`step-${index}`,stamp,stamp).run()
  for(let index=0;index<5;index++)await env.DB.prepare('INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,completed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(`response-${index}`,'workspace','flow','revision',`session-${index}`,`hash-${index}`,`receipt-${index}`,'released',stamp,stamp,stamp).run()
  for (let index = 0; index < 130; index++) await env.DB.prepare('INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(`answer-${index}`,`response-${Math.floor(index/26)}`,`step-${index%26}`,JSON.stringify(exact),stamp,stamp).run()
  // PAY-001: a paid response's state and Stripe IDs travel; its live checkout link and return key do not.
  await env.DB.prepare(`INSERT INTO response_payments(response_id,step_id,completion_step_id,provider,livemode,state,attempt,amount,currency,lines_json,checkout_session_id,checkout_url,checkout_expires_at,payment_intent_id,provider_amount,return_token_hash,state_changed_at,created_at,updated_at)
    VALUES('response-0','step-24','step-25','stripe',0,'paid',2,1250,'usd',?,'cs_test_restore','https://checkout.stripe.com/c/pay/cs_test_restore',?,'pi_test_restore',1250,'restore-return-hash',?,?,?)`).bind(JSON.stringify([{name:'Order',unitAmount:1250,quantity:1}]),stamp,stamp,stamp,stamp).run()
  await env.DB.prepare("INSERT INTO payment_events(id,type,response_id,outcome,created_at,received_at) VALUES('evt_test_restore','checkout.session.completed','response-0','applied',?,?)").bind(stamp,stamp).run()
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  expect(JSON.stringify(archive.payload.tables.filter(table=>table.name==='response_payments'))).not.toMatch(/checkout\.stripe\.com|restore-return-hash/)
  const allSchema = (await env.DB.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name!='_cf_METADATA' ORDER BY type,name").all()).results
  const tables = [archive.payload.d1Migrations,...archive.payload.tables]
  const foreignKeys = Object.fromEntries(await Promise.all(tables.map(async table => [table.name,(await env.DB.prepare(`PRAGMA foreign_key_list(${quote(table.name)})`).all()).results])))
  await restoreFixture(env.DB, empty)
  const store = { ...archive, sha256:'a'.repeat(64), *rows(index:number) { yield* archive.payload.tables[index].rows } }
  const plan = stagingPlan(store, {schema:allSchema,foreignKeys})
  await query([...destinationGuards(store,empty.payload.schema),...plan.create])
  await stageRows(query,store,plan)
  expect(await env.DB.prepare('SELECT count(*) n FROM response_answers').first()).toEqual({n:0})
  expect(await env.DB.prepare(`SELECT count(*) n FROM ${quote(plan.names.response_answers)}`).first()).toEqual({n:130})
  const answerTable = archive.payload.tables.find(table=>table.name==='response_answers')!
  let cursor: string | undefined, rows = 0, pages = 0
  for (;;) {
    const statement = pageStatement({...answerTable,name:plan.names.response_answers},cursor)
    const page = (await env.DB.prepare(statement.sql).bind(...statement.params).all<{cursor:string;v3:string}>()).results
    if (!page.length) break
    expect(page.length).toBeLessThanOrEqual(128)
    for (const row of page) expect(JSON.parse(row.v3)).toBe(JSON.stringify(exact))
    cursor=page.at(-1)!.cursor;rows+=page.length;pages++
  }
  expect(rows).toBe(130);expect(pages).toBeGreaterThan(1)
  const stagedSchema=JSON.stringify((await env.DB.prepare(schemaQuery).all()).results)
  const publish=[...destinationGuards(store,stagedSchema),...plan.publish]
  await expect(query([...publish,{sql:"SELECT json('forced publication failure')"}])).rejects.toThrow()
  expect(await env.DB.prepare('SELECT count(*) n FROM response_answers').first()).toEqual({n:0})
  expect(await env.DB.prepare(`SELECT count(*) n FROM ${quote(plan.names.response_answers)}`).first()).toEqual({n:130})
  await env.DB.prepare('INSERT INTO local_fixture_initializations VALUES(?,?)').bind('concurrent',stamp).run()
  await expect(query(publish)).rejects.toThrow()
  expect(await env.DB.prepare('SELECT count(*) n FROM local_fixture_initializations').first()).toEqual({n:1})
  await cleanupStage(query,plan)
  expect(JSON.stringify((await env.DB.prepare(schemaQuery).all()).results)).toBe(empty.payload.schema)
  expect((await env.DB.prepare("SELECT name FROM sqlite_schema WHERE name GLOB '_pencil_restore_*'").all()).results).toEqual([])
  expect(await env.DB.prepare('SELECT count(*) n FROM local_fixture_initializations').first()).toEqual({n:1})
  expect(await env.DB.prepare('SELECT count(*) n FROM responses').first()).toEqual({n:0})
  await env.DB.prepare('DELETE FROM local_fixture_initializations WHERE id=?').bind('concurrent').run()
  await query([...destinationGuards(store,empty.payload.schema),...plan.create])
  await stageRows(query,store,plan)
  const lostAcknowledgment=async () => {await query(publish);throw new Error('Publication acknowledgment lost')}
  await expect(lostAcknowledgment()).rejects.toThrow('Publication acknowledgment lost')
  await cleanupStage(query,plan)
  const restored = await archiveFixture(env.DB,__PENCIL_CORE_MIGRATIONS__)
  canonicalSchema(JSON.parse(restored.payload.schema),archive.payload.schema)
  expect({...restored,payload:{...restored.payload,schema:archive.payload.schema}}).toEqual(archive)
  expect(await env.DB.prepare('SELECT state,attempt,amount,checkout_session_id,payment_intent_id,provider_amount,checkout_url,return_token_hash FROM response_payments').first()).toEqual({state:'paid',attempt:2,amount:1250,checkout_session_id:'cs_test_restore',payment_intent_id:'pi_test_restore',provider_amount:1250,checkout_url:null,return_token_hash:null})
  expect(await env.DB.prepare('SELECT id,response_id FROM payment_events').first()).toEqual({id:'evt_test_restore',response_id:'response-0'})
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  expect((await env.DB.prepare("SELECT name FROM sqlite_schema WHERE name GLOB '_pencil_restore_*'").all()).results).toEqual([])
  await expect(env.DB.prepare('INSERT INTO response_answers SELECT * FROM response_answers LIMIT 1').run()).rejects.toThrow()
})

