import { activeAssignment } from './visibility'
/** Ledger/report/export response predicate. The caller's response alias is r. */
export function responseCodeFilter(codeId: string) {
  return {
    sql: `EXISTS (SELECT 1 FROM answer_code_assignments ca JOIN response_answers caa ON caa.id=ca.answer_id
      JOIN workspace_codes cc ON cc.id=ca.code_id AND cc.workspace_id=r.workspace_id
      WHERE ca.workspace_id=r.workspace_id AND caa.response_id=r.id AND ca.code_id=? AND ${activeAssignment})`,
    bindings: [codeId],
  }
}
