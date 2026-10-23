import { confirmationLive, confirmationRecipient } from '../../src/core/features/notifications/confirmation-queue'
import type { DevelopmentMessage } from '../../src/base/mail/src/development/index.mjs'
export function confirmationCaptureClaim(message:DevelopmentMessage) {
  const to=Array.isArray(message.to)?message.to:[message.to]
  const recipient=to.length===1?(typeof to[0]==='string'?to[0]:to[0].email):null
  return {sql:`EXISTS(SELECT 1 FROM confirmation_deliveries d JOIN responses r ON r.id=d.response_id JOIN flow_revisions v ON v.id=r.revision_id
    JOIN confirmation_attempts a ON a.delivery_id=d.id AND a.ordinal=d.attempts AND a.event='started'
    WHERE d.id=? AND d.status='sending' AND d.armed=1 AND d.recipient=? AND a.id=? AND a.ordinal=? AND ${confirmationLive} AND ${confirmationRecipient})`,bindings:[message.deliveryId,recipient,message.headers?.['X-Pencil-Confirmation-Claim']??null,Number(message.headers?.['X-Pencil-Confirmation-Attempt']??0)]}
}
