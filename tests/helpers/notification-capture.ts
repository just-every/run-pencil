import type { DevelopmentCaptureClaim } from './captured-mail.server'
/** Optional product predicate, evaluated in Base's capture transaction. */
export const notificationCaptureClaim: DevelopmentCaptureClaim = message => ({
  sql: `EXISTS (SELECT 1 FROM notification_deliveries d
    JOIN responses r ON r.id=d.response_id JOIN operators o ON o.id=d.operator_id
    JOIN notification_preferences p ON p.flow_id=r.flow_id AND p.operator_id=d.operator_id
    WHERE d.idempotency_key=? AND d.status='sending' AND r.state='released' AND (r.notification_eligible=1 OR d.explicit_retry_authorized=1)
      AND p.mode='immediately' AND lower(o.email)=lower(?)
      AND d.attempts=? AND EXISTS(SELECT 1 FROM notification_attempts a WHERE a.id=? AND a.delivery_id=d.id AND a.ordinal=d.attempts AND a.event='started')
      AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators a ON a.id=l.auth_id WHERE l.operator_id=o.id AND a.status='inactive'))`,
  bindings: [message.deliveryId, message.to.length===1 ? message.to[0] : '', message.headers?.['X-Pencil-Notification-Attempt'] ?? '', message.headers?.['X-Pencil-Notification-Claim'] ?? ''],
})
