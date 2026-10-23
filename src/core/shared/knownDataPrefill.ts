import type { ChoiceOption, FlowStep } from '../app/api'
import { answerIssue, isUnanswered } from './answers'
import { ValidationError } from './errors'
import manifest from '../../../seed.json' with { type: 'json' }

export type PrefillMapping = { stepId: string; field: string; locked: boolean }
export type PrefilledAnswer = { value: string; locked: boolean }
export type PrefillMarker = 'unchanged' | 'edited' | 'locked'

// Phone and other structured answers cannot consume a contact's raw string.
const stringTypes = new Set(['short_text', 'long_text', 'email', 'url', 'date', 'single_choice', 'dropdown'])
const reservedFields = new Set(['__proto__', 'constructor', 'prototype'])

export function prefillSettingsIssue(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 250) return 'Choose at most 250 known-data prefill mappings.'
  const stepIds = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return 'Each prefill mapping must be an object.'
    if (Object.keys(item).some(key => !['stepId', 'field', 'locked'].includes(key))) return 'Unknown prefill mapping setting.'
    const mapping = item as Record<string, unknown>
    if (typeof mapping.stepId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(mapping.stepId) || stepIds.has(mapping.stepId)) return 'Each prefill mapping needs a distinct stable question ID.'
    if (typeof mapping.field !== 'string' || !mapping.field.length || mapping.field !== mapping.field.trim() || mapping.field.length > manifest.limits.contacts.fieldKeyCharacters || reservedFields.has(mapping.field)) return 'Each prefill mapping needs a valid stored contact field key.'
    if (typeof mapping.locked !== 'boolean') return 'Choose whether each prefilled answer is locked.'
    stepIds.add(mapping.stepId)
  }
}

function supportsPrefill(step: FlowStep): boolean {
  return step.kind === 'question' && stringTypes.has(step.questionType ?? '')
}

export function prefillPublicationIssues(mappings: PrefillMapping[], steps: FlowStep[]): Array<{ stepId: string; reason: string }> {
  const byId = new Map(steps.map(step => [step.id, step]))
  const issues: Array<{ stepId: string; reason: string }> = []
  for (const mapping of mappings) {
    const step = byId.get(mapping.stepId)
    if (!step) issues.push({ stepId: mapping.stepId, reason: 'The prefill mapping refers to a deleted question.' })
    else if (!supportsPrefill(step)) issues.push({ stepId: mapping.stepId, reason: 'Known-data prefill requires a question that accepts a text, email, URL, date or single-choice string answer.' })
  }
  return issues
}

export function resolvePrefills(mappings: PrefillMapping[], fields: Record<string, string>, steps: FlowStep[], choices: ChoiceOption[]): Record<string, PrefilledAnswer> {
  const prefills: Record<string, PrefilledAnswer> = Object.create(null)
  const byId = new Map(steps.map(step => [step.id, step]))
  const choiceIds = new Map<string, string[]>()
  for (const choice of choices) {
    const ids = choiceIds.get(choice.stepId) ?? []
    ids.push(choice.id)
    choiceIds.set(choice.stepId, ids)
  }
  for (const mapping of mappings) {
    const step = byId.get(mapping.stepId)
    if (!step || !supportsPrefill(step) || !Object.hasOwn(fields, mapping.field)) continue
    const value = fields[mapping.field]
    if (typeof value !== 'string' || isUnanswered(value) || answerIssue(step, choiceIds.get(step.id) ?? [], value)) continue
    prefills[step.id] = { value, locked: mapping.locked }
  }
  return prefills
}

export function prefillMarkers(prefills: Record<string, PrefilledAnswer>, answers: Array<{ stepId: string; value: unknown }>): Record<string, PrefillMarker> {
  const markers: Record<string, PrefillMarker> = Object.create(null)
  const submitted = new Set<string>()
  for (const answer of answers) {
    if (!Object.hasOwn(prefills, answer.stepId)) continue
    const prefill = prefills[answer.stepId]
    if (prefill.locked && answer.value !== prefill.value) throw new ValidationError('A locked prefilled answer cannot be changed.', [{ stepId: answer.stepId, reason: 'Keep the locked prefilled answer.' }])
    submitted.add(answer.stepId)
    markers[answer.stepId] = prefill.locked ? 'locked' : answer.value === prefill.value ? 'unchanged' : 'edited'
  }
  for (const [stepId, prefill] of Object.entries(prefills)) {
    if (prefill.locked && !submitted.has(stepId)) throw new ValidationError('A locked prefilled answer cannot be omitted.', [{ stepId, reason: 'Include the locked prefilled answer.' }])
  }
  return markers
}
