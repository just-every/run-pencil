import { calculationInputs } from './calculationInputs'
import { evaluateCalculations } from './calculations'
import type { ChoiceOption, FlowStep, PublicFlow } from '../app/api'
import { answerIssue, isUnanswered } from './answers'
import { contactQuestionTypes, displayContactAnswer } from './contactAnswers'
import { displayCalendarDate } from './dateFormat'
import { visiblePath } from './flowPath'
import { isOtherAnswer, selectedChoiceIds } from './otherChoices'
import { scoreOptions, scoreQuestionTypes } from './scoreQuestions'

export type FlowGraph = Pick<PublicFlow, 'steps' | 'choices' | 'branchRules' | 'branchSelection' | 'formSettings' | 'hiddenContext'>
export type RecallEdges = ReadonlyMap<string, readonly string[]>
export type RecallIssue = { stepId: string; reason: string }
type Answers = Record<string, unknown>

function references(text: string) {
  return [...text.matchAll(/\{\{([^{}]*)\}\}/g)].map(match => match[1].trim())
}

/** Stored consent includes its statement; the respondent controls use a boolean. */
function runtimeValue(step: FlowStep, value: unknown): unknown {
  if (step.questionType !== 'consent' || !value || typeof value !== 'object' || Array.isArray(value)) return value
  const consent = value as Record<string, unknown>
  return typeof consent.accepted === 'boolean' && typeof consent.statement === 'string' && consent.statement === step.questionSettings?.statement ? consent.accepted : undefined
}

export function formattedAnswer(step: FlowStep, choices: ChoiceOption[], value: unknown, choiceLabel: (text: string) => string): string {
  if ((contactQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return displayContactAnswer(step.questionType!, value)
  if (step.questionType === 'date') return displayCalendarDate(value as string, step.questionSettings ?? {})
  if ((scoreQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return scoreOptions(step.questionType!).find(option => option.value === value)!.label
  if (step.questionType === 'yes_no') return value ? 'Yes' : 'No'
  if (step.questionType === 'consent') return value ? 'Accepted' : 'Declined'
  if (['single_choice', 'multiple_choice', 'dropdown', 'priority'].includes(step.questionType ?? '')) {
    // Admission validates the complete Other shape before it reaches formatting.
    const other = isOtherAnswer(value) ? value : undefined
    const ids = selectedChoiceIds(value)
    return ids.map((id, index) => {
      const label = other && id === step.questionSettings?.otherChoiceId ? other.otherText : choiceLabel(choices.find(choice => choice.id === id)!.label)
      return step.questionType === 'priority' ? `${index + 1}. ${label}` : label
    }).join(step.questionType === 'priority' ? '\n' : ', ')
  }
  return String(value)
}

/** Returns plain text. Render the result in a React text node, never as HTML.
 * A single replacement pass keeps tokens in respondent answers inert.
 * Operator-authored choice labels resolve against the path before their question.
 * Missing, invalid, skipped and off-path answers insert an empty string.
 */
export function interpolateAnswerRecall(text: string, flow: FlowGraph, answers: Answers, currentStepId: string): string {
  const choicesByStep = new Map(flow.steps.map(step => [step.id, flow.choices.filter(choice => choice.stepId === step.id)]))
  const valid = Object.fromEntries(flow.steps.flatMap(step => {
    if (step.kind !== 'question' || !Object.hasOwn(answers, step.id)) return []
    const value = runtimeValue(step, answers[step.id])
    const choices = choicesByStep.get(step.id)!
    return isUnanswered(value) || answerIssue(step, choices.map(choice => choice.id), value) ? [] : [[step.id, value]]
  }))
  // visiblePath needs only the graph fields; keeping its traversal here shared
  // ensures changing an earlier branch immediately hides stale answers.
  const path = visiblePath(flow, valid)
  const currentIndex = path.findIndex(step => step.id === currentStepId)
  const earlier = new Map(path.slice(0, Math.max(0, currentIndex)).filter(step => step.kind === 'question').map(step => [step.id, step]))
  return text.replace(/\{\{([^{}]*)\}\}/g, (_token, reference: string) => {
    const id = reference.trim(), step = earlier.get(id)
    if (id.startsWith('variable:') && flow.formSettings?.calculations?.some(value=>`variable:${value.id}`===id)) {
      const accepted=Object.fromEntries([...earlier.keys()].filter(id=>Object.hasOwn(valid,id)).map(id=>[id,valid[id]]))
      return String(evaluateCalculations(flow.formSettings.calculations,accepted,flow.hiddenContext?.hidden ?? {})[id.slice(9)] ?? '')
    }
    if (id.startsWith('hidden:') && flow.formSettings?.hiddenFields.some(field=>`hidden:${field.id}`===id)) return String(flow.hiddenContext?.hidden[id.slice(7)] ?? '')
    return step && Object.hasOwn(valid, id) ? formattedAnswer(step, choicesByStep.get(id)!, valid[id], label => interpolateAnswerRecall(label, flow, answers, step.id)) : ''
  })
}

/** Builder hints can use structural edges. Publication should pass the graph
 * validator's feasible edges, which account for rule precedence and bounds.
 */
function structuralEdges(flow: FlowGraph): RecallEdges {
  return new Map(flow.steps.map(step => [step.id, step.kind === 'completion' ? [] : [
    ...(step.nextStepId ? [step.nextStepId] : []),
    ...flow.branchRules.filter(rule => rule.sourceStepId === step.id).map(rule => rule.destinationStepId),
  ]]))
}

function reachable(start: string, edges: RecallEdges, stopAt?: string): Set<string> {
  const seen = new Set<string>(), pending = [start]
  while (pending.length) {
    const id = pending.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    if (id !== stopAt) pending.push(...(edges.get(id) ?? []))
  }
  return seen
}

export function earlierRecallQuestions(flow: FlowGraph, currentStepId: string, edges: RecallEdges = structuralEdges(flow)): FlowStep[] {
  const first = flow.steps.slice().sort((a, b) => a.position - b.position)[0]
  if (!first) return []
  const beforeCurrent = reachable(first.id, edges, currentStepId)
  return flow.steps.filter(step => step.kind === 'question' && step.id !== currentStepId && beforeCurrent.has(step.id) && reachable(step.id, edges).has(currentStepId)).sort((a, b) => a.position - b.position)
}

/** stepId is the stable destination containing the invalid reference.
 * A conditional earlier answer is allowed; it is blank on paths that skip it.
 */
export function validateAnswerRecall(flow: FlowGraph, edges: RecallEdges = structuralEdges(flow)): RecallIssue[] {
  const issues: RecallIssue[] = [], byId = new Map(flow.steps.map(step => [step.id, step]))
  const first = flow.steps.slice().sort((a, b) => a.position - b.position)[0]
  const fromStart = first ? reachable(first.id, edges) : new Set<string>()
  for (const destination of flow.steps) {
    const earlier = new Set(earlierRecallQuestions(flow, destination.id, edges).map(step => step.id))
    const texts = [destination.prompt, destination.helperText ?? '', ...flow.choices.filter(choice => choice.stepId === destination.id).map(choice => choice.label)]
    for (const reference of new Set(texts.flatMap(references))) {
      if (reference.startsWith('variable:') && flow.formSettings?.calculations?.some(value=>`variable:${value.id}`===reference)) {
        const inputs=calculationInputs(flow.formSettings.calculations,reference.slice(9))
        if ([...inputs.answers].some(id=>!earlier.has(id))) issues.push({stepId:destination.id,reason:`Calculation recall “${reference}” depends on a missing, current or later question.`})
        continue
      }
      if (flow.formSettings?.hiddenFields.some(field=>`hidden:${field.id}`===reference)) continue
      const source = byId.get(reference)
      let reason: string | undefined
      if (!source) reason = `Recall reference “${reference}” does not name an existing question or declared hidden field.`
      else if (source.kind !== 'question') reason = `Recall reference “${reference}” names a screen that has no answer.`
      else if (source.id === destination.id) reason = `Recall reference “${reference}” must name an earlier question, not the current question.`
      else if (!fromStart.has(source.id) || !fromStart.has(destination.id)) reason = `Recall reference “${reference}” is unreachable from the first screen.`
      else if (!earlier.has(source.id)) reason = reachable(destination.id, edges).has(source.id)
        ? `Recall reference “${reference}” names a future question.`
        : `Recall reference “${reference}” cannot be reached before this screen on the same path.`
      if (reason) issues.push({ stepId: destination.id, reason })
    }
  }
  return issues
}

/** Copying a form gives its questions new IDs, including their text references. */
export function remapAnswerRecall(text: string, ids: ReadonlyMap<string, string>): string {
  return text.replace(/\{\{([^{}]*)\}\}/g, (token, reference: string) => ids.has(reference.trim()) ? `{{${ids.get(reference.trim())}}}` : token)
}
