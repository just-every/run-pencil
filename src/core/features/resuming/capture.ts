import type { DevelopmentMessage } from '../../../base/mail/src/development/index.mjs'
import { sessionCollectorAdmissionSql } from '../collectors'

/** Test mail-edge predicate: capture and erasure serialize in the same D1
 * transaction. A delivery must still belong to this recipient's live save. */
export function resumeCaptureClaim(message: DevelopmentMessage) {
  const now=new Date().toISOString()
  const open=sessionCollectorAdmissionSql('s.id','r.flow_id',now,'s.source')
  return {sql:`EXISTS(SELECT 1 FROM respondent_saves saved JOIN respondent_sessions s ON s.id=saved.session_id
    JOIN flow_revisions r ON r.id=s.revision_id JOIN flows f ON f.id=r.flow_id
    WHERE saved.delivery_id=? AND saved.delivery_state='sending' AND saved.response_id IS NULL AND saved.delivery_email=?
      AND saved.token_hash IS NOT NULL AND saved.expires_at>? AND s.expires_at>?
      AND r.admission_closed_at IS NULL AND (r.deadline_at IS NULL OR r.deadline_at>?)
      AND f.status IN ('open','closed') AND ${open.sql})`,bindings:[message.deliveryId,message.to.length===1?message.to[0]:'',now,now,now,...open.params]}
}
