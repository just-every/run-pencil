import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { NotificationRepository } from '../../src/core/features/notifications/repository'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
contract(['NOTIFY-002'],'notification upgrade preserves old answers and pending outbox while preventing replay and leaving existing flow preference Off',async()=>{
  const notificationMigration=__PENCIL_CORE_MIGRATIONS__.findIndex(m=>m.name.includes('response_notifications'))
  expect(notificationMigration).toBeGreaterThan(0)
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__.slice(0,notificationMigration))
  const now='2026-10-08T00:00:00.000Z'
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES('legacy-workspace','Legacy business','UTC','09:00','17:00',?,?)").bind(now,now),
    env.DB.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES('legacy-operator','legacy-workspace','legacy@example.test','Operator',1,?,?)").bind(now,now),
    env.DB.prepare("INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES('legacy-flow','legacy-workspace','legacy','Legacy flow','open',1,?,?,?)").bind(now,now,now),
    env.DB.prepare("INSERT INTO flow_revisions(id,flow_id,number,state,title,is_current,created_at,updated_at) VALUES('legacy-revision','legacy-flow',1,'published','Legacy flow',1,?,?)").bind(now,now),
    env.DB.prepare("INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,completed_at,created_at,updated_at) VALUES('legacy-response','legacy-workspace','legacy-flow','legacy-revision','legacy-session','synthetic-hash','legacy-key','released',?,?,?)").bind(now,now,now),
    env.DB.prepare("INSERT INTO response_outbox(id,workspace_id,response_id,kind,idempotency_key,payload_json,status,available_at,created_at,updated_at) VALUES('legacy-event','legacy-workspace','legacy-response','response.completed','legacy-event-key','{}','pending',?,?,?)").bind(now,now,now),
    env.DB.prepare("INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at) VALUES('legacy-answer','legacy-response','question','\"retained answer\"',?,?)").bind(now,now),
  ])
  const before=(await env.DB.prepare('SELECT * FROM response_answers').all()).results
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__)
  const preferences=new NotificationRepository(env.DB)
  expect((await preferences.read('legacy-workspace','legacy-flow','legacy-operator')).mode).toBe('off')
  await preferences.set('legacy-workspace','legacy-flow','legacy-operator','immediately')
  const dispatcher=new NotificationDispatcher(env.DB,{send:async()=>{throw new Error('Legacy data must not send')}} ,'https://forms.example.test','noreply@example.test')
  expect(await dispatcher.run(now)).toMatchObject({attempted:0})
  expect(await env.DB.prepare("SELECT status,notification_eligible FROM response_outbox WHERE id='legacy-event'").first()).toEqual({status:'pending',notification_eligible:0})
  expect((await env.DB.prepare('SELECT * FROM response_answers').all()).results).toEqual(before)
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
