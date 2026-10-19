import type { D1Sql } from '../../../base/import-kit/src/d1/types'
import { analysisErasureStatements } from '../analysis'
import { eraseResponseLocalMailStatement } from '../../platform/mail/erasure'

/** Shared DATA-002 writes for manual and scheduled erasure, including quarantined rows. */
export function responseErasureStatements(input: { workspaceId:string; responseId:string; operatorId:string|null; now:string; state:'released'|'quarantined'; feature?:'retention' }, auditId:string): D1Sql[] {
  return [
      { sql: `INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, workspace_id, ${input.feature==='retention'?"'retention.response-erased'":"'response.erased'"}, (SELECT id FROM operators WHERE id = ? AND workspace_id = responses.workspace_id), 'response', NULL, '{}', ? FROM responses
        WHERE id = ? AND workspace_id = ? AND state = ?`, params: [auditId, input.operatorId, input.now, input.responseId, input.workspaceId, input.state] },
      { sql: `UPDATE revision_metric_counters SET completions = MAX(0, completions - 1),
        total_completion_milliseconds = MAX(0, total_completion_milliseconds - COALESCE((SELECT completion_milliseconds FROM responses WHERE id = ?), 0)), updated_at = ?
        WHERE revision_id = (SELECT revision_id FROM responses WHERE id = ? AND source != 'imported' AND state='released') AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`, params: [input.responseId, input.now, input.responseId, auditId] },
      { sql: `UPDATE audit_entries SET subject_id = NULL, details_json = '{}' WHERE workspace_id = ? AND subject_type = 'response' AND subject_id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`, params: [input.workspaceId, input.responseId, auditId] },
      eraseResponseLocalMailStatement(input.responseId, input.workspaceId, auditId),
      { sql: 'DELETE FROM response_outbox WHERE response_id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)', params: [input.responseId, auditId] },
      ...analysisErasureStatements('SELECT id FROM responses WHERE id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)', [input.responseId, auditId], input.now),
      { sql: 'DELETE FROM response_answers WHERE response_id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)', params: [input.responseId, auditId] },
      { sql: `DELETE FROM respondent_session_step_events WHERE session_id = (SELECT session_id FROM responses WHERE id = ?) AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`, params: [input.responseId, auditId] },
      { sql: `DELETE FROM respondent_sessions WHERE id = (SELECT session_id FROM responses WHERE id = ?) AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`, params: [input.responseId, auditId] },
      { sql: `DELETE FROM form_import_targets WHERE target_id = ? AND workspace_id = ? AND kind = 'response' AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`, params: [input.responseId, input.workspaceId, auditId] },
      { sql: `DELETE FROM responses WHERE id = ? AND workspace_id = ? AND state = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`, params: [input.responseId, input.workspaceId, input.state, auditId] },
    ]
}
