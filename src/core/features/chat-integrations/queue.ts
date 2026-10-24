import { reminderDates } from '../actions'
import { workspaceToday } from '../actions'
import { unpaidResponseSql } from '../payments/admission'

export const eligibleChatResponse = `r.state='released' AND r.notification_eligible=1 AND r.source IN('direct','embed','invitation') AND NOT ${unpaidResponseSql('r.id')}`
export const eligibleChatAction = `a.reminders_enabled=1 AND a.verdict IS NULL AND a.state IN('planned','in_progress','ready_for_review') AND a.owner_operator_id=t.operator_id AND o.id=t.operator_id AND o.workspace_id=a.workspace_id
 AND NOT EXISTS(SELECT 1 FROM operator_auth_links authlink JOIN oa_operators auth ON auth.id=authlink.auth_id WHERE authlink.operator_id=o.id AND auth.status='inactive')`

export async function materializeChatResponses(db:D1Database,now:string) {
  await db.prepare(`INSERT OR IGNORE INTO chat_deliveries(id,link_id,response_id,kind,idempotency_key,state,available_at,updated_at)
    SELECT lower(hex(randomblob(16))),l.id,r.id,'response','chat:response:'||l.id||':'||r.id,'pending',?,? FROM chat_form_links l JOIN responses r ON r.flow_id=l.flow_id AND r.workspace_id=l.workspace_id
    WHERE l.armed=1 AND COALESCE(json_extract(l.settings_json,'$.postResponses'),1)=1 AND ${eligibleChatResponse} AND COALESCE(r.released_at,r.completed_at)>=l.updated_at
    AND NOT EXISTS(SELECT 1 FROM chat_deliveries existing WHERE existing.idempotency_key='chat:response:'||l.id||':'||r.id)
    ORDER BY r.completed_at,r.id LIMIT 100`).bind(now,now).run()
}
export async function materializeChatReminders(db:D1Database,now:string) {
  let cursor=''
  while(true) {
    const rows=await db.prepare(`SELECT t.id,a.id AS actionId,a.review_date AS reviewDate,a.created_at AS createdAt,w.time_zone AS timeZone,
      (SELECT MAX(d.due_date) FROM chat_deliveries d WHERE d.action_target_id=t.id AND d.kind='overdue' AND d.review_date=a.review_date) AS lastOverdue
      FROM chat_action_targets t JOIN chat_form_links l ON l.id=t.link_id JOIN actions a ON a.id=t.action_id JOIN operators o ON o.id=t.operator_id JOIN workspaces w ON w.id=a.workspace_id
      WHERE t.id>? AND l.armed=1 AND ${eligibleChatAction} ORDER BY t.id LIMIT 100`).bind(cursor).all<{id:string;actionId:string;reviewDate:string;createdAt:string;timeZone:string;lastOverdue:string|null}>()
    if(!rows.results.length)break
    const due=rows.results.flatMap(row=>reminderDates(row.reviewDate,workspaceToday(row.timeZone,new Date(now)),workspaceToday(row.timeZone,new Date(row.createdAt)),row.lastOverdue).map(date=>({...date,targetId:row.id,reviewDate:row.reviewDate})))
    if(due.length) await db.prepare(`INSERT OR IGNORE INTO chat_deliveries(id,link_id,action_target_id,kind,due_date,review_date,idempotency_key,state,available_at,updated_at)
      SELECT lower(hex(randomblob(16))),t.link_id,t.id,json_extract(j.value,'$.kind'),json_extract(j.value,'$.dueDate'),a.review_date,
      'chat:reminder:'||t.id||':'||a.review_date||':'||json_extract(j.value,'$.kind')||':'||json_extract(j.value,'$.dueDate'),'pending',?,?
      FROM json_each(?) j JOIN chat_action_targets t ON t.id=json_extract(j.value,'$.targetId') JOIN actions a ON a.id=t.action_id JOIN operators o ON o.id=t.operator_id JOIN chat_form_links l ON l.id=t.link_id
      WHERE l.armed=1 AND a.review_date=json_extract(j.value,'$.reviewDate') AND ${eligibleChatAction}`).bind(now,now,JSON.stringify(due)).run()
    cursor=rows.results.at(-1)!.id
  }
  await db.prepare(`UPDATE chat_deliveries SET state='cancelled',reason='Action, owner or connection is no longer eligible.',updated_at=? WHERE kind<>'response' AND state IN('pending','sending')
    AND NOT EXISTS(SELECT 1 FROM chat_action_targets t JOIN chat_form_links l ON l.id=t.link_id JOIN actions a ON a.id=t.action_id JOIN operators o ON o.id=t.operator_id WHERE t.id=chat_deliveries.action_target_id AND l.armed=1 AND a.review_date=chat_deliveries.review_date AND ${eligibleChatAction})`).bind(now).run()
}
