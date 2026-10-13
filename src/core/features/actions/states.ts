/** The action lifecycle (ACT-002), shared by the server and the operator pages. */
export const actionStates = ['planned', 'in_progress', 'ready_for_review', 'effective', 'ineffective', 'closed'] as const
export type ActionState = typeof actionStates[number]
export type Verdict = 'effective' | 'ineffective'

/** ACT-002, exactly: every other move is refused. */
export const legalTransitions: Record<ActionState, readonly ActionState[]> = {
  planned: ['in_progress', 'closed'],
  in_progress: ['ready_for_review', 'closed'],
  ready_for_review: ['effective', 'ineffective', 'in_progress', 'closed'],
  effective: ['closed'],
  ineffective: ['closed'],
  closed: [],
}
export const stateLabels: Record<ActionState, string> = { planned: 'Planned', in_progress: 'In progress', ready_for_review: 'Ready for review', effective: 'Effective', ineffective: 'Ineffective', closed: 'Closed' }
/** A review date is surfaced only while the action still waits for a verdict. */
export const awaitingReview: readonly ActionState[] = ['planned', 'in_progress', 'ready_for_review']
/** Reviewed and closed actions keep their record as it was measured. */
export const editableStates: readonly ActionState[] = ['planned', 'in_progress', 'ready_for_review']
