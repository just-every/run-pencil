import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect, test } from 'vitest'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
test('additive distribution migration preserves prior anonymous rows, original values and graph links', async () => {
  const previous = __PENCIL_CORE_MIGRATIONS__.filter(m => !m.name.includes('invitation_distribution'))
  await applyD1Migrations(env.DB, previous)
  const at = '2026-01-01T00:00:00.000Z'
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspaces (id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES ('prior-w','Prior','UTC','09:00','17:00',?,?)").bind(at,at),
    env.DB.prepare("INSERT INTO flows (id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES ('prior-f','prior-w','prior-flow','Prior flow','open',1,?,?,?)").bind(at,at,at),
    env.DB.prepare("INSERT INTO flow_revisions (id,flow_id,number,state,title,is_current,created_at,updated_at) VALUES ('prior-r','prior-f',1,'published','Prior revision',1,?,?)").bind(at,at),
    env.DB.prepare("INSERT INTO flow_steps (id,revision_id,position,stable_id,kind,question_type,prompt,required,created_at,updated_at) VALUES ('prior-step','prior-r',0,'stable-prior','question','short_text','Original prompt',1,?,?)").bind(at,at),
    env.DB.prepare("INSERT INTO responses (id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,completion_milliseconds,completed_at,created_at,updated_at,source,started_at,released_at) VALUES ('prior-response','prior-w','prior-f','prior-r','prior-session','synthetic-hash','prior-idempotency','released',12000,?,?,?,'direct',?,?)").bind(at,at,at,at,at),
    env.DB.prepare("INSERT INTO response_answers (id,response_id,step_id,value_json,created_at,updated_at) VALUES ('prior-answer','prior-response','stable-prior',?, ?,?)").bind(JSON.stringify('original\nquoted "value"'),at,at),
  ])
  const before = (await env.DB.prepare('SELECT * FROM responses').all()).results
  const answers = (await env.DB.prepare('SELECT * FROM response_answers').all()).results
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  const after = (await env.DB.prepare('SELECT * FROM responses').all()).results
  expect(after.map(({ participant_id, ...row }) => { expect(participant_id).toBeNull(); return row })).toEqual(before)
  expect((await env.DB.prepare('SELECT * FROM response_answers').all()).results).toEqual(answers)
  expect(await env.DB.prepare("SELECT a.step_id, s.prompt FROM response_answers a JOIN responses r ON r.id=a.response_id JOIN flow_steps s ON s.stable_id=a.step_id AND s.revision_id=r.revision_id").first()).toEqual({ step_id: 'stable-prior', prompt: 'Original prompt' })
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  expect((await env.DB.prepare('SELECT * FROM responses').all()).results).toEqual(after)
})
