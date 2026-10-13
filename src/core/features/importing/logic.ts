import { object } from './fields'
import type { ImportForm, ImportStep } from './model'
function condition(raw: unknown, step: ImportStep): { predicate: string; expected: unknown } | undefined {
  const c = object(raw), vars = Array.isArray(c.vars) ? c.vars : []
  const ref = vars[0], value = vars[1]
  if (['and', 'or'].includes(c.op) && step.questionType === 'multiple_choice') {
    const parts = vars.map((v: unknown) => condition(v, step))
    if (parts.length && parts.every((p: any) => p?.predicate === 'any_of')) return { predicate: c.op === 'and' ? 'all_of' : 'any_of', expected: parts.flatMap((p: any) => p.expected) }
    return
  }
  if (ref?.type !== 'field' || ref.value !== step.sourceId || !value) return
  if (['single_choice', 'dropdown', 'multiple_choice'].includes(step.questionType ?? '') && c.op === 'is' && value.type === 'choice') {
    const choice = step.choices.find(v => v.sourceId === String(value.value))
    if (choice) return { predicate: step.questionType === 'multiple_choice' ? 'any_of' : 'equals', expected: step.questionType === 'multiple_choice' ? [choice.id] : choice.id }
  }
  if (step.questionType === 'yes_no' && c.op === 'is' && value.type === 'constant' && typeof value.value === 'boolean') return { predicate: 'equals', expected: value.value }
  const operators: Record<string, string> = { is: 'equals', equal: 'equals', greater_than: 'greater_than', greater_equal_than: 'greater_than_or_equal', lower_than: 'less_than', lower_equal_than: 'less_than_or_equal' }
  if (['rating', 'nps', 'number'].includes(step.questionType ?? '') && operators[c.op] && value.type === 'constant' && typeof value.value === 'number' && Number.isFinite(value.value)) return { predicate: operators[c.op], expected: value.value }
}
export function mapLogic(form: ImportForm, raw: unknown) {
  const incomplete = new Set<ImportStep>()
  const firstQuestion = form.steps.find(step => step.kind === 'question')
  for (const [i, item] of (Array.isArray(raw) ? raw : []).entries()) {
    const logic = object(item), actions = Array.isArray(logic.actions) ? logic.actions : []
    if (!actions.length) { const source = form.steps.find(step => step.sourceId === logic.ref && step.kind === 'question') ?? firstQuestion; if (source) incomplete.add(source); form.report.push({ location: `/logic/${i}`, label: String(logic.ref ?? 'Logic'), sourceType: String(logic.type ?? ''), state: 'unsupported', change: 'No path imported', reason: 'No supported jump action.' }) }
    let defaultSeen = false
    for (const [j, actionValue] of actions.entries()) {
      const action = object(actionValue), details = object(action.details), to = object(details.to), c = object(action.condition)
      const source = form.steps.find(s => s.sourceId === logic.ref && s.kind === 'question')
      const destination = form.steps.find(s => s.sourceId === to.value && s.kind !== 'welcome')
      const report = { location: `/logic/${i}/actions/${j}`, label: source?.prompt ?? String(logic.ref ?? 'Logic'), sourceType: String(action.action ?? 'unknown'), state: 'unsupported' as 'imported' | 'unsupported', change: 'No path imported', reason: 'Only same-question supported comparisons and forward destinations are imported; calculations, hidden variables and cross-question conditions are omitted.' }
      if (logic.type === 'field' && source && destination && action.action === 'jump' && !defaultSeen && ['field', 'thankyou'].includes(to.type)) {
        const mapped = condition(c, source)
        if (c.op === 'always') { source.next = destination.id; defaultSeen = true; report.state = 'imported'; report.change = `${source.prompt} → ${destination.prompt} (default)`; report.reason = 'Ordered unconditional jump.' }
        else if (mapped) { form.rules.push({ source: source.id, destination: destination.id, predicate: mapped.predicate, expected: mapped.expected, position: form.rules.filter(r => r.source === source.id).length }); report.state = 'imported'; report.change = `${source.prompt} → ${destination.prompt}`; report.reason = `First matching ${mapped.predicate} path.` }
      }
      form.report.push(report)
      if (report.state === 'unsupported' && (source ?? firstQuestion)) incomplete.add((source ?? firstQuestion)!)
    }
  }
  for (const source of incomplete) source.next = null
}
