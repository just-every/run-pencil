import { env } from 'cloudflare:test'

const ownedFlows=new Set<string>()
export function ownNotificationFixture<T extends {flow:{flowId:string}}>(fixture: T): T {
  ownedFlows.add(fixture.flow.flowId)
  return fixture
}

/** These suites share the native database. Retire only their own mail work so
 * later Cron tests cannot accidentally deliver an earlier case's queued mail. */
export async function clearOwnedNotificationWork() {
  for (const flowId of ownedFlows) await env.DB.batch([
    env.DB.prepare('DELETE FROM chat_deliveries WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?)').bind(flowId),
    env.DB.prepare('DELETE FROM chat_form_links WHERE flow_id=?').bind(flowId),
    env.DB.prepare('DELETE FROM answer_alert_deliveries WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?)').bind(flowId),
    env.DB.prepare('DELETE FROM answer_alert_evaluations WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?)').bind(flowId),
    env.DB.prepare(`DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN
      (SELECT d.idempotency_key FROM notification_deliveries d JOIN responses r ON r.id=d.response_id WHERE r.flow_id=?)`).bind(flowId),
    env.DB.prepare('DELETE FROM response_outbox WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?)').bind(flowId),
    env.DB.prepare('DELETE FROM notification_deliveries WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?)').bind(flowId),
  ])
  ownedFlows.clear()
}
