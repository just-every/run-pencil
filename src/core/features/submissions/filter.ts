/** Pure shared SQL; reporting owns the ledger and never imports a submission service. */
export type WorkflowFilter = { workflowStatus?: string; workflowAssignee?: string; workflowTag?: string }
export function workflowScope(filter: WorkflowFilter) {
  const parts: string[] = [], bindings: unknown[] = []
  if (filter.workflowStatus) { parts.push("COALESCE((SELECT w.status_id FROM submission_workflows w WHERE w.response_id=r.id),'new') = ?"); bindings.push(filter.workflowStatus) }
  if (filter.workflowAssignee === 'unassigned') parts.push('NOT EXISTS (SELECT 1 FROM submission_workflows w WHERE w.response_id=r.id AND w.assignee_id IS NOT NULL)')
  else if (filter.workflowAssignee) { parts.push('EXISTS (SELECT 1 FROM submission_workflows w WHERE w.response_id=r.id AND w.assignee_id=?)'); bindings.push(filter.workflowAssignee) }
  if (filter.workflowTag) { parts.push('EXISTS (SELECT 1 FROM submission_tags t WHERE t.response_id=r.id AND t.tag=?)'); bindings.push(filter.workflowTag) }
  return { parts, bindings }
}
