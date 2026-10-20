export type BranchSelection = 'first-matching-rule' | 'last-matching-rule'
export type FlowPolicies = {
  'response.review.v1'?: boolean
  'flow.branch-selection.v1': BranchSelection
  'response.identity.v1': 'anonymous-public-link' | 'identified-public-link'
  'flow.response-admission.v1': 'independent-direct-completions'
}
export const defaultFlowPolicies: FlowPolicies = Object.freeze({
  'response.review.v1': false,
  'flow.branch-selection.v1': 'first-matching-rule',
  'response.identity.v1': 'anonymous-public-link',
  'flow.response-admission.v1': 'independent-direct-completions',
})
export function evaluateFlowPolicies(value: FlowPolicies): FlowPolicies {
  if (value['response.review.v1'] !== undefined && typeof value['response.review.v1'] !== 'boolean') throw new Error('Unsupported response review policy; publication cannot proceed.')
  if (!['first-matching-rule', 'last-matching-rule'].includes(value['flow.branch-selection.v1']) || !['anonymous-public-link','identified-public-link'].includes(value['response.identity.v1']) || value['flow.response-admission.v1'] !== 'independent-direct-completions') throw new Error('Unsupported flow policy configuration; publication cannot proceed.')
  return Object.freeze({ ...value })
}
export function revisionBranchSelection(snapshot: string | null): BranchSelection {
  // Pre-policy revisions used the documented first-match semantics. No current
  // configuration is consulted when interpreting immutable historical graphs.
  if (snapshot === null) return 'first-matching-rule'
  return evaluateFlowPolicies(JSON.parse(snapshot) as FlowPolicies)['flow.branch-selection.v1']
}

/** A missing key, including pre-policy revisions, never enables review. */
export function revisionReviewEnabled(snapshot: string | null): boolean {
  return snapshot !== null && evaluateFlowPolicies(JSON.parse(snapshot) as FlowPolicies)['response.review.v1'] === true
}
