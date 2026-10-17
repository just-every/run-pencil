import { isRecallKey, recallTokens } from '../../shared/recallSyntax'
import type { StoredChoice, StoredStep } from './repository'
import type { GraphIssue } from './graph'

export function recallGraphIssues(steps: StoredStep[], choices: StoredChoice[]): GraphIssue[] {
  const issues: GraphIssue[] = []
  const named = new Map<string, StoredStep[]>()
  for (const step of steps) {
    let settings: unknown
    try { settings = JSON.parse(step.questionSettingsJson ?? '{}') } catch { continue }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || !('recallKey' in settings)) continue
    const key = settings.recallKey
    if (step.kind !== 'question') {
      issues.push({ stepId: step.stableId, reason: 'Recall keys belong only to question steps.' })
    } else if (!isRecallKey(key)) {
      issues.push({ stepId: step.stableId, reason: 'A recall key must start with an ASCII letter and contain at most 40 ASCII letters, digits or underscores.' })
    } else named.set(key, [...named.get(key) ?? [], step])
  }
  for (const [key, sources] of named) if (sources.length > 1) {
    for (const source of sources) issues.push({ stepId: source.stableId, reason: `Recall key “${key}” names more than one question. Give each question its own key.` })
  }
  for (const step of steps) {
    const templates = [step.prompt, step.helperText ?? '', ...choices.filter(choice => choice.stepId === step.id).map(choice => choice.label)]
    const references = new Set(templates.flatMap(text => recallTokens(text).map(token => token.key)))
    for (const key of references) {
      const sources = named.get(key)
      if (!sources?.length) issues.push({ stepId: step.stableId, reason: `Recall reference “{{${key}}}” names an unknown question.` })
      else if (sources.some(source => source.position >= step.position)) issues.push({ stepId: step.stableId, reason: `Recall reference “{{${key}}}” must name an earlier question; it cannot refer to this question or a later one.` })
    }
  }
  return issues
}
