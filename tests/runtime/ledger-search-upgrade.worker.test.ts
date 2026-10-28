import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { googleHttp } from './google-import-http'
import type { Ledger } from '../../src/core/app/api'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]

contract(["LEDG-006","LEDG-008"], 'answers collected before the stored-search migration become searchable without changing the retained answers', async () => {
  // 0.7.0 ends at 0052. Write the rows its response door stored on that schema, then apply the additive search
  // migration and successors. Current code needs those successors (PAY-001's 0055), so it starts only afterwards.
  const before = __PENCIL_CORE_MIGRATIONS__.filter(migration => migration.name < '0053')
  const after = __PENCIL_CORE_MIGRATIONS__.filter(migration => migration.name >= '0053')
  await applyD1Migrations(env.DB, before)
  const workspace = crypto.randomUUID(), flowId = crypto.randomUUID(), revisionId = crypto.randomUUID(), responseId = crypto.randomUUID(), now = new Date().toISOString()
  const slug = `search-upgrade-${crypto.randomUUID()}`, value = JSON.stringify('Le CAFE\u0301 près de la Straße. Очень ВКУСНО.')
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES(?,'Older café','UTC','09:00','17:00',?,?)").bind(workspace, now, now),
    env.DB.prepare("INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES(?,?,?,'Older café responses','open',1,?,?,?)").bind(flowId, workspace, slug, now, now, now),
    env.DB.prepare("INSERT INTO flow_revisions(id,flow_id,number,state,title,published_at,is_current,created_at,updated_at) VALUES(?,?,1,'published','Older café responses',?,1,?,?)").bind(revisionId, flowId, now, now, now),
    env.DB.prepare("INSERT INTO flow_steps(id,revision_id,position,kind,question_type,prompt,required,stable_id,next_step_stable_id,created_at,updated_at) VALUES(?,?,0,'question','long_text','What did you enjoy?',1,'enjoyed','thanks',?,?),(?,?,1,'completion',NULL,'Thank you.',0,'thanks',NULL,?,?)").bind(crypto.randomUUID(), revisionId, now, now, crypto.randomUUID(), revisionId, now, now),
    env.DB.prepare("INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,released_at,completion_milliseconds,completed_at,created_at,updated_at,source,started_at) VALUES(?,?,?,?,?,?,?,'released',?,5000,?,?,?,'direct',?)").bind(responseId, workspace, flowId, revisionId, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), now, now, now, now, now),
    env.DB.prepare('INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), responseId, 'enjoyed', value, now, now),
  ])
  const retained = (await env.DB.prepare('SELECT * FROM response_answers WHERE response_id=?').bind(responseId).all()).results
  await applyD1Migrations(env.DB, after)
  expect((await env.DB.prepare('SELECT * FROM response_answers WHERE response_id=?').bind(responseId).all()).results).toEqual(retained)
  const http = await googleHttp(workspace), path = `/api/app/flows/${flowId}`
  for (const search of ['café près de la STRASSE', 'очень вкусно']) {
    const response = await http.call(`${path}/ledger?${new URLSearchParams({ search })}`)
    expect(response.status).toBe(200)
    const ledger = await response.json() as Ledger
    expect(ledger.total).toBe(1)
    expect(ledger.responses.map(row => row.id)).toEqual([responseId])
  }
}, 60_000)
