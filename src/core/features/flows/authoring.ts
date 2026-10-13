import type { BranchRule, BuilderDraft } from '../../app/api'

export type EditableRule = Omit<BranchRule, 'id'> & { id?: string }
export type EditableChoice = { id?: string; newId?: string; value: string; label: string }
export type AuthoringDraft = BuilderDraft & { flow: BuilderDraft['flow'] & { hasUnpublishedChanges?: boolean } }

export function choiceValue(label: string, taken: string[]) {
  const base = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || 'choice'
  let value = base
  for (let suffix = 2; taken.includes(value); suffix++) value = `${base}-${suffix}`
  return value
}

export function stepRules(draft: BuilderDraft, stepId: string) {
  return draft.branchRules.filter(rule => rule.sourceStepId === stepId).sort((a, b) => a.position - b.position)
}
