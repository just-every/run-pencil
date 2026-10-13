import { validateRevisionGraph, type StoredBranchRule, type StoredChoice, type StoredStep } from '../flows'
import type { ImportForm } from './model'
export function reportGraph(form: ImportForm) {
  const stamp = '2000-01-01T00:00:00.000Z'
  const steps = form.steps.map((s, position) => ({ id: s.id, stableId: s.id, revisionId: 'review', position, kind: s.kind, questionType: s.questionType, prompt: s.prompt, helperText: s.helperText, required: s.required, nextStepStableId: s.next, questionSettingsJson: JSON.stringify(s.settings), createdAt: stamp, updatedAt: stamp })) as StoredStep[]
  const choices: StoredChoice[] = form.steps.flatMap(s => s.choices.map((c, position) => ({ id: c.id, stableId: c.id, stepId: s.id, position, value: c.id, label: c.label, createdAt: stamp, updatedAt: stamp })))
  const rules = form.rules.map((r, index) => ({ id: `rule-${index}`, revisionId: 'review', sourceStepStableId: r.source, predicateKind: r.predicate, expectedValueJson: JSON.stringify(r.expected), destinationStepStableId: r.destination, position: r.position, createdAt: stamp, updatedAt: stamp })) as StoredBranchRule[]
  for (const issue of validateRevisionGraph(steps, choices, rules)) form.report.push({ location: `/graph/${issue.stepId}`, label: form.steps.find(s => s.id === issue.stepId)?.prompt ?? 'Flow graph', sourceType: 'native validation', state: 'changed', change: 'Draft needs repair before publication', reason: issue.reason })
}
