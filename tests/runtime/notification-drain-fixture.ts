import { env } from 'cloudflare:test'
import { notificationFixture } from './notifications-fixture'
import { ownNotificationFixture } from './notification-test-scope'

export async function notificationDrainFixture(slug: string, count: number, operatorCount = 1) {
  const f = ownNotificationFixture(await notificationFixture(slug)), now = new Date().toISOString()
  const operators = [f.operatorId]
  for (let i=1;i<operatorCount;i++) {
    const id = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .bind(id,f.scope.workspaceId,`${slug}-${i}@operator.example.test`,'Synthetic recipient',now,now).run()
    await f.services.notifications.preferences.set(f.scope.workspaceId,f.flow.flowId,id,'immediately')
    operators.push(id)
  }
  const template = await f.submit()
  if (count>1) await env.DB.batch([
    env.DB.prepare(`WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM numbers WHERE n<?)
      INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,released_at,completion_milliseconds,completed_at,created_at,updated_at,source,notification_eligible)
      SELECT r.id||':'||n,r.workspace_id,r.flow_id,r.revision_id,r.session_id||':'||n,'',r.idempotency_key||':'||n,'released',r.released_at,0,r.completed_at,r.created_at,r.updated_at,'direct',1
      FROM responses r CROSS JOIN numbers WHERE r.id=?`).bind(count-1,template.response.id),
    env.DB.prepare(`INSERT INTO response_outbox(id,workspace_id,response_id,kind,idempotency_key,payload_json,status,available_at,created_at,updated_at,notification_eligible)
      SELECT 'outbox-'||r.id,r.workspace_id,r.id,'response.completed','response.completed:'||r.id,
        json_set(x.payload_json,'$.responseId',r.id),'pending',x.available_at,x.created_at,x.updated_at,1
      FROM responses r JOIN response_outbox x ON x.response_id=? WHERE r.flow_id=? AND r.id<>?`)
      .bind(template.response.id,f.flow.flowId,template.response.id),
  ])
  return { ...f, operators, template }
}
