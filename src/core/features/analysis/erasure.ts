import type { D1Sql } from '../../../base/import-kit/src/d1/index'

/** DATA-002 for analysis: an erased response leaves no stored analysis that holds it. Its evidence, membership and quotes go;
 * the provider's own text for every theme it supported, the run's recommendation and summary are withheld, since they may
 * paraphrase it. `responses` is a SQL subquery naming the erased response IDs. Run these before the responses are deleted. */
export function analysisErasureStatements(responses: string, params: unknown[], now: string): D1Sql[] {
  const runs = `SELECT run_id FROM analysis_evidence WHERE response_id IN (${responses})`
  return [
    // Capture custody uses the IDs actually sent, including failed/queued calls
    // and captures made before this migration. No provider prose is searched.
    { sql: `DELETE FROM rer_ai_development_outbox WHERE json_extract(record,'$.feature')='analysis' AND EXISTS (
      SELECT 1 FROM json_each(CASE WHEN json_valid(json_extract(record,'$.request.input[1].content[0].text'))
        THEN json_extract(record,'$.request.input[1].content[0].text') ELSE '{}' END,'$.responses') captured
      WHERE json_extract(captured.value,'$.id') IN (${responses}))`, params },
    { sql: `DELETE FROM analysis_finding_decisions WHERE run_id IN (${runs})`, params },
    { sql: `DELETE FROM analysis_contradictions WHERE run_id IN (${runs})`, params },
    { sql: `UPDATE analysis_themes SET title = 'Withheld after an erasure', summary = NULL WHERE run_id IN (${runs})`, params },
    { sql: `UPDATE analysis_recommendations SET title = 'Withheld after an erasure', rationale = NULL WHERE run_id IN (${runs})`, params },
    { sql: `UPDATE analysis_runs SET state = CASE WHEN state IN ('queued','running') THEN 'failed' ELSE state END, next_attempt_at = NULL, lease_until = NULL, error_code = CASE WHEN state IN ('queued','running') THEN 'evidence_erased' ELSE error_code END, error_message = CASE WHEN state IN ('queued','running') THEN 'Evidence was erased. Request a new analysis.' ELSE error_message END, summary = NULL, insufficient_reason = CASE WHEN insufficient_reason IS NULL THEN NULL ELSE 'Evidence changed after erasure; request a new analysis.' END, evidence_count = evidence_count - (SELECT COUNT(*) FROM analysis_evidence e WHERE e.run_id = analysis_runs.id AND e.response_id IN (${responses})), redacted_at = ? WHERE id IN (${runs})`, params: [...params, now, ...params] },
    { sql: `DELETE FROM analysis_quotes WHERE response_id IN (${responses})`, params },
    { sql: `DELETE FROM analysis_theme_members WHERE response_id IN (${responses})`, params },
    { sql: `DELETE FROM analysis_evidence WHERE response_id IN (${responses})`, params },
  ]
}
