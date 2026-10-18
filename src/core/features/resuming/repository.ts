import { sessionCollectorAdmissionSql } from '../collectors'

export type SavedRow = {
  session_id: string; revision_id: string; token_hash: string | null; command_key: string
  delivery_id: string; delivery_email: string | null; delivery_state: 'sending' | 'sent' | 'failed' | 'completed'
  response_context_json: string | null; current_step_id: string | null; answers_json: string | null; participant_id: string | null
  response_id: string | null; completion_step_id: string | null; expires_at: string; created_at: string; updated_at: string
}

export class ResumeRepository {
  constructor(private readonly db: D1Database) {}
  bySession(id: string) { return this.db.prepare('SELECT * FROM respondent_saves WHERE session_id=?').bind(id).first<SavedRow>() }
  byHash(hash: string) { return this.db.prepare('SELECT * FROM respondent_saves WHERE token_hash=?').bind(hash).first<SavedRow>() }

  async invitation(token: string) {
    return this.db.prepare(`SELECT p.id,p.revision_id,p.token,p.response_status,lc.collector_id
      FROM invitation_participants p JOIN invitation_launch_collector lc ON lc.launch_id=p.launch_id
      WHERE p.token=?`).bind(token).first<{ id: string; revision_id: string; token: string; response_status: string; collector_id: string }>()
  }
  async invitationToken(id: string) {
    return this.db.prepare("SELECT token FROM invitation_participants WHERE id=? AND token IS NOT NULL AND response_status!='completed'").bind(id).first<{ token: string }>()
  }
  async ownsInvitation(sessionId: string, collectorId: string) {
    return !!await this.db.prepare('SELECT 1 FROM session_collector WHERE session_id=? AND collector_id=?').bind(sessionId, collectorId).first()
  }

  async save(input: { sessionId: string; sessionHash: string; revisionId: string; tokenHash: string; commandKey: string; deliveryId: string; email: string; stepId: string; answers: string; responseContext:string; participantId: string | null; expiresAt: string; now: string }) {
    const open = sessionCollectorAdmissionSql('s.id', 'f.id', input.now, 's.source')
    const results = await this.db.batch([
      this.db.prepare(`INSERT INTO respondent_saves(session_id,revision_id,token_hash,command_key,delivery_id,delivery_email,delivery_state,current_step_id,answers_json,response_context_json,participant_id,expires_at,created_at,updated_at)
        SELECT s.id,s.revision_id,?,?,?,?,'sending',?,?,?,?,?,?,?
        FROM respondent_sessions s JOIN flow_revisions r ON r.id=s.revision_id JOIN flows f ON f.id=r.flow_id
        WHERE s.id=? AND s.session_token_hash=? AND s.revision_id=? AND s.completed_at IS NULL AND s.expires_at>?
          AND f.status IN ('open','closed') AND r.admission_closed_at IS NULL AND (r.deadline_at IS NULL OR r.deadline_at>?)
          AND (r.target_completed_responses IS NULL OR (SELECT count(*) FROM responses WHERE revision_id=r.id AND state='released')<r.target_completed_responses)
          AND ((s.source!='invitation' AND ? IS NULL) OR (s.source='invitation' AND EXISTS(
            SELECT 1 FROM invitation_participants p JOIN invitation_launch_collector lc ON lc.launch_id=p.launch_id
            JOIN session_collector sc ON sc.collector_id=lc.collector_id AND sc.session_id=s.id
            WHERE p.id=? AND p.revision_id=r.id AND p.token IS NOT NULL AND p.response_status!='completed')))
          AND ${open.sql}
        ON CONFLICT(session_id) DO UPDATE SET token_hash=excluded.token_hash,command_key=excluded.command_key,
          delivery_id=excluded.delivery_id,delivery_email=excluded.delivery_email,delivery_state='sending',current_step_id=excluded.current_step_id,
          response_context_json=excluded.response_context_json,answers_json=excluded.answers_json,participant_id=excluded.participant_id,expires_at=excluded.expires_at,updated_at=excluded.updated_at
        WHERE respondent_saves.response_id IS NULL AND (respondent_saves.delivery_state!='sending' OR respondent_saves.updated_at<?)`)
        .bind(input.tokenHash,input.commandKey,input.deliveryId,input.email,input.stepId,input.answers,input.responseContext,input.participantId,input.expiresAt,input.now,input.now,
          input.sessionId,input.sessionHash,input.revisionId,input.now,input.now,input.participantId,input.participantId,...open.params,new Date(Date.parse(input.now)-5*60_000).toISOString()),
      this.db.prepare(`UPDATE respondent_sessions SET expires_at=?,updated_at=? WHERE id=? AND EXISTS(
        SELECT 1 FROM respondent_saves WHERE session_id=? AND token_hash=? AND delivery_state='sending' AND updated_at=?)`)
        .bind(input.expiresAt,input.now,input.sessionId,input.sessionId,input.tokenHash,input.now),
    ])
    return results[0].meta.changes > 0
  }

  async delivered(sessionId: string, deliveryId: string, sent: boolean, now: string) {
    const result = await this.db.prepare(`UPDATE respondent_saves SET delivery_state=?,delivery_email=CASE WHEN ? THEN NULL ELSE delivery_email END,updated_at=?
      WHERE session_id=? AND delivery_id=? AND delivery_state='sending' AND response_id IS NULL`)
      .bind(sent?'sent':'failed',sent?1:0,now,sessionId,deliveryId).run()
    return result.meta.changes > 0
  }

  async activate(row: SavedRow, sessionHash: string, now: string) {
    const open = sessionCollectorAdmissionSql('respondent_sessions.id', 'r.flow_id', now, 'respondent_sessions.source')
    const result = await this.db.prepare(`UPDATE respondent_sessions SET session_token_hash=?,updated_at=?
      WHERE id=? AND expires_at>? AND completed_at IS NULL AND EXISTS(
        SELECT 1 FROM respondent_saves saved JOIN flow_revisions r ON r.id=saved.revision_id JOIN flows f ON f.id=r.flow_id
        WHERE saved.session_id=respondent_sessions.id AND saved.token_hash=? AND saved.expires_at>?
          AND saved.response_id IS NULL AND f.status IN ('open','closed') AND r.admission_closed_at IS NULL
          AND (r.deadline_at IS NULL OR r.deadline_at>?)
          AND (r.target_completed_responses IS NULL OR (SELECT count(*) FROM responses WHERE revision_id=r.id AND state='released')<r.target_completed_responses)
          AND (saved.participant_id IS NULL OR EXISTS(SELECT 1 FROM invitation_participants p WHERE p.id=saved.participant_id AND p.token IS NOT NULL AND p.response_status!='completed'))
          AND ${open.sql})`).bind(sessionHash,now,row.session_id,now,row.token_hash,now,now,...open.params).run()
    return result.meta.changes > 0
  }
}
