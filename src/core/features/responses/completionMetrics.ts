/** Final path validation proves visits even when individual progress events are absent. */
export function completionMetricStatements(binding: D1Database, input: { revisionId: string; responseId: string; sessionId: string; reachedStepIds: string[]; completedAt: string }) {
  return input.reachedStepIds.map(stepId => binding.prepare(`INSERT INTO revision_step_metric_counters (id, revision_id, step_stable_id, reached, dropped, created_at, updated_at)
    SELECT ?, ?, ?, 1, 0, ?, ? WHERE EXISTS (SELECT 1 FROM responses WHERE id = ?)
    AND NOT EXISTS (SELECT 1 FROM respondent_session_step_events WHERE session_id = ? AND step_stable_id = ?)
    ON CONFLICT(revision_id, step_stable_id) DO UPDATE SET reached = reached + 1, updated_at = excluded.updated_at`
  ).bind(`step-metric-${input.revisionId}-${stepId}`, input.revisionId, stepId, input.completedAt, input.completedAt, input.responseId, input.sessionId, stepId))
}
