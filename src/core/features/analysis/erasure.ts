import type { D1Sql } from '../../../base/import-kit/src/d1/index'

/** DATA-002 for analysis: an erased response leaves no stored analysis that holds it. Its evidence, membership and quotes go;
 * the provider's own text for every theme it supported, the run's recommendation and summary are withheld, since they may
 * paraphrase it. `responses` is a SQL subquery naming the erased response IDs. Run these before the responses are deleted. */
export function analysisErasureStatements(responses: string, params: unknown[], now: string): D1Sql[] {
  const runs = `SELECT run_id FROM analysis_evidence WHERE response_id IN (${responses})`
  return [
    { sql: `UPDATE analysis_themes SET title = 'Withheld after an erasure', summary = NULL WHERE id IN (SELECT theme_id FROM analysis_theme_members WHERE response_id IN (${responses}))`, params },
    { sql: `UPDATE analysis_recommendations SET title = 'Withheld after an erasure', rationale = NULL WHERE run_id IN (${runs})`, params },
    { sql: `UPDATE analysis_runs SET summary = NULL, evidence_count = evidence_count - (SELECT COUNT(*) FROM analysis_evidence e WHERE e.run_id = analysis_runs.id AND e.response_id IN (${responses})), redacted_at = ? WHERE id IN (${runs})`, params: [...params, now, ...params] },
    { sql: `DELETE FROM analysis_quotes WHERE response_id IN (${responses})`, params },
    { sql: `DELETE FROM analysis_theme_members WHERE response_id IN (${responses})`, params },
    { sql: `DELETE FROM analysis_evidence WHERE response_id IN (${responses})`, params },
  ]
}
