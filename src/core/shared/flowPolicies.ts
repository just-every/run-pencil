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
  return revisionPolicies(snapshot)['flow.branch-selection.v1']
}

/** Decode the retained predecessor policy format without rewriting released rows. */
function revisionPolicies(snapshot: string): FlowPolicies {
  const value = JSON.parse(snapshot)
  if (value && Object.keys(value).sort().join(',') === 'branchSelection,identity,responseAdmission'
    && value.branchSelection?.kind === 'first-match' && Object.keys(value.branchSelection).length === 1
    && value.identity?.direct === 'anonymous' && value.identity?.invitation === 'identified' && Object.keys(value.identity).length === 2
    && value.responseAdmission?.invitationCompletions === 1 && Object.keys(value.responseAdmission).length === 1) {
    return defaultFlowPolicies
  }
  return evaluateFlowPolicies(value as FlowPolicies)
}

/** A missing key, including pre-policy revisions, never enables review. */
export function revisionReviewEnabled(snapshot: string | null): boolean {
  return snapshot !== null && revisionPolicies(snapshot)['response.review.v1'] === true
}
