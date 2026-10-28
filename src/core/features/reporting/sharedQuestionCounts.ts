import { responseScope } from './scope'
import { crossableQuestionTypes } from './crosstabDimensions'
import type { LedgerFilter } from './repository'
import type { SharedQuestion } from './savedModel'

/** Unstructured questions publish only answer presence; no stored value is selected. */
export async function sharedQuestionCounts(db: D1Database, input: { workspaceId: string; flowId: string; revisionId: string; filter: LedgerFilter; cutoff: string; responseCount: number }): Promise<SharedQuestion[]> {
  const scope = responseScope(input.workspaceId, input.flowId, input.filter, input.cutoff)
  const result = await db.prepare(`WITH scoped AS (SELECT r.id FROM responses r WHERE ${scope.where})
    SELECT s.stable_id AS id,s.prompt,s.question_type AS type,COUNT(DISTINCT a.response_id) AS answered
    FROM flow_steps s LEFT JOIN response_answers a ON a.step_id=s.stable_id AND a.response_id IN (SELECT id FROM scoped)
    WHERE s.revision_id=? AND s.kind='question' GROUP BY s.id ORDER BY s.position`).bind(...scope.bindings, input.revisionId).all<{ id: string; prompt: string; type: string; answered: number }>()
  return result.results.filter(question => question.type !== 'matrix' && !crossableQuestionTypes.includes(question.type)).map(question => ({ id: question.id, prompt: question.prompt, questionType: question.type, answered: question.answered, unanswered: input.responseCount - question.answered, multipleSelect: false, distribution: [], note: 'Only answer counts are published for this question; its contents are private.' }))
}
