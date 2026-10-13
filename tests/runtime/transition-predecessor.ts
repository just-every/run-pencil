// The predecessor's three-statement storage protocol remains supported while
// old and new Worker instances overlap after the additive migration.
export async function predecessorAdvance(binding: D1Database, input: {
  sessionId: string; sessionToken: string; revisionId: string; slug: string; stepId: string
}) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.sessionToken))
  const hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
  const now = new Date().toISOString()
  return binding.batch([
    binding.prepare(`UPDATE respondent_sessions SET furthest_step_id = ?, updated_at = ?
      WHERE id = ? AND session_token_hash = ? AND completed_at IS NULL AND expires_at > ?
      AND EXISTS (SELECT 1 FROM flow_steps q JOIN flow_revisions r ON r.id = q.revision_id JOIN flows f ON f.id = r.flow_id
        WHERE q.revision_id = respondent_sessions.revision_id AND q.stable_id = ? AND f.slug = ?)`)
      .bind(input.stepId, now, input.sessionId, hash, now, input.stepId, input.slug),
    binding.prepare(`INSERT INTO revision_step_metric_counters (id, revision_id, step_stable_id, reached, dropped, created_at, updated_at)
      SELECT 'step-metric-' || revision_id || '-' || ?, revision_id, ?, 1, 0, ?, ? FROM respondent_sessions
      WHERE id = ? AND changes() = 1 AND NOT EXISTS (SELECT 1 FROM respondent_session_step_events WHERE session_id = ? AND step_stable_id = ?)
      ON CONFLICT(revision_id, step_stable_id) DO UPDATE SET reached = reached + 1, updated_at = excluded.updated_at`)
      .bind(input.stepId, input.stepId, now, now, input.sessionId, input.sessionId, input.stepId),
    binding.prepare(`INSERT INTO respondent_session_step_events (id, session_id, revision_id, step_stable_id, counted_at, created_at)
      SELECT ?, id, revision_id, ?, ?, ? FROM respondent_sessions WHERE id = ? AND changes() = 1`)
      .bind(`event-${input.sessionId}-${input.stepId}`, input.stepId, now, now, input.sessionId),
  ])
}
