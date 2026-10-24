import type { DevelopmentCaptureClaim } from './captured-mail.server'
export const answerAlertCaptureClaim:DevelopmentCaptureClaim=message=>({
  sql:`EXISTS(SELECT 1 FROM answer_alert_deliveries d JOIN responses r ON r.id=d.response_id JOIN operators o ON o.id=d.operator_id
    WHERE d.idempotency_key=? AND d.status='sending' AND d.armed=1 AND d.attempts=? AND r.state='released' AND r.notification_eligible=1
    AND lower(o.email)=lower(?) AND o.workspace_id=r.workspace_id
    AND EXISTS(SELECT 1 FROM answer_alert_attempts a WHERE a.id=? AND a.delivery_id=d.id AND a.ordinal=d.attempts AND a.event='started')
    AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators a ON a.id=l.auth_id WHERE l.operator_id=o.id AND a.status='inactive'))`,
  bindings:[message.deliveryId,Number(message.headers?.['X-Pencil-Notification-Attempt']??0),message.to.length===1?message.to[0]:'',message.headers?.['X-Pencil-Notification-Claim']??''],
})
