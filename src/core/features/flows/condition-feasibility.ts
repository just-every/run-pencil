import { proveCalculatedConditions } from './calculation-proof'
import type { Calculation } from '../../shared/calculations'
import { answerIssue } from '../../shared/answers'
import { evaluateCondition, type Condition } from '../../shared/conditions'
import { scoreOptions, scoreQuestionTypes } from '../../shared/scoreQuestions'
import { textTypeLimit } from '../../shared/textValidation'
import { contactQuestionTypes } from '../../shared/contactAnswers'
import { numericCandidates, dateCandidates } from './ordered-answer-domain'
import { selectionIsPossible } from './selection-constraints'
import { priorityIsPossible } from './priority-constraints'
import type { StoredStep } from './repository'

type Test = Extract<Condition, { kind: 'test' }>
type LeafRequirement = { condition: Test; matched: boolean }
export type ConditionQuestion = { step: Pick<StoredStep,'stableId'|'required'|'questionType'|'prompt'>; choices: string[]; settings: Record<string, unknown> }
export type ConditionRequirement = { condition: Condition; matched: boolean; available?: ReadonlySet<string> }
export type ConditionProofBudget = { remaining: number }
export class ConditionProofError extends Error {}

export function spendConditionProof(budget: ConditionProofBudget) {
  if (--budget.remaining < 0) throw new ConditionProofError('The condition graph exceeds the exact reachability proof limit. Simplify its branching before publishing.')
}

function localAnswerExists(question: ConditionQuestion, requirements: LeafRequirement[]) {
  const { step, choices, settings } = question
  const satisfies = (value: unknown) => requirements.every(({ condition, matched }) => evaluateCondition(condition, { [step.stableId]: value }).matched === matched)
  if (!step.required && satisfies(undefined)) return true
  // A present answer cannot satisfy a blank test, or a negated answered test.
  if (requirements.some(({ condition, matched }) => condition.operator === 'is_blank' && matched || condition.operator === 'is_answered' && !matched)) return false
  const tests = requirements.filter(({ condition }) => !['is_blank', 'is_answered'].includes(condition.operator))
  const valid = (value: unknown) => !answerIssue({ ...step, questionSettings: settings }, choices, value)
  const some = (values: unknown[]) => values.some(value => valid(value) && satisfies(value))
  const otherAvailable = () => {
    const validation = settings.otherValidation as Record<string, unknown> | undefined ?? {}
    if (validation.pattern !== undefined || validation.inputMask !== undefined) throw new ConditionProofError('Exact condition reachability for Other answers with a pattern or mask is not supported yet.')
    const length = Math.max(1, Number(validation.minLength ?? 0))
    if (length > Number(validation.maxLength ?? textTypeLimit('short_text'))) return false
    return !answerIssue({ prompt: step.prompt, questionType: 'short_text', required: true, questionSettings: validation }, [], 'x'.repeat(length))
  }
  if (['single_choice', 'dropdown'].includes(step.questionType ?? '')) {
    if (choices.filter(choice => choice !== settings.otherChoiceId).some(choice => some([choice]))) return true
    if (!choices.includes(String(settings.otherChoiceId)) || !satisfies(settings.otherChoiceId) || !otherAvailable()) return false
    const validation = settings.otherValidation as Record<string, unknown> | undefined ?? {}
    return some([{ choiceIds: [String(settings.otherChoiceId)], otherText: 'x'.repeat(Math.max(1, Number(validation.minLength ?? 0))) }])
  }
  if (step.questionType === 'yes_no' || step.questionType === 'consent') return some([true, false])
  if ((scoreQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return some(scoreOptions(step.questionType!).map(option => option.value))
  if (step.questionType === 'nps') return some(Array.from({ length: 11 }, (_, index) => index))
  if (step.questionType === 'rating') return some(Array.from({ length: Number(settings.max) - Number(settings.min) + 1 }, (_, index) => Number(settings.min) + index))
  if (step.questionType === 'number') {
    const boundaries = [settings.min, settings.max, ...tests.map(({ condition }) => condition.value)].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    return some(numericCandidates(boundaries, settings.decimalPlaces as number | undefined))
  }
  if (step.questionType === 'date') {
    const boundaries = ['0001-01-01', '9999-12-31', settings.earliest, settings.latest, ...tests.map(({ condition }) => condition.value)].filter((value): value is string => typeof value === 'string')
    return some(dateCandidates(boundaries))
  }
  if (step.questionType === 'multiple_choice') {
    const clauses: number[][] = []
    for (const { condition, matched } of tests) {
      const expected = condition.value as string[]
      const indexes = expected.map(choice => choices.indexOf(choice) + 1)
      if (indexes.some(index => index === 0)) throw new ConditionProofError('A condition references a choice outside its question.')
      if (condition.operator === 'exactly' || condition.operator === 'equals' || condition.operator === 'not_equals') {
        const equal = condition.operator === 'not_equals' ? !matched : matched
        const literals = choices.map((choice, index) => expected.includes(choice) ? index + 1 : -(index + 1))
        clauses.push(...(equal ? literals.map(literal => [literal]) : [literals.map(literal => -literal)]))
      } else {
        const positive = condition.operator === 'none_of' ? !matched : matched
        const literals = indexes.map(index => positive ? index : -index)
        const conjunctive = condition.operator === 'all_of' ? matched : !positive
        clauses.push(...(conjunctive ? literals.map(literal => [literal]) : [literals]))
      }
    }
    const none = choices.indexOf(String(settings.noneChoiceId)) + 1
    if (none && satisfies([settings.noneChoiceId])) return true
    if (none) clauses.push([-none])
    const min = Math.max(1, Number(settings.minSelections ?? 1)), max = Number(settings.maxSelections ?? choices.length)
    const other = choices.indexOf(String(settings.otherChoiceId)) + 1
    if (!other) return selectionIsPossible(choices.length, clauses, min, max)
    if (selectionIsPossible(choices.length, [...clauses, [-other]], min, max)) return true
    return otherAvailable() && selectionIsPossible(choices.length, clauses, min, max)
  }
  if (step.questionType === 'priority') {
    const equalities = tests.filter(({ condition }) => ['equals', 'not_equals', 'exactly'].includes(condition.operator))
    const positive = equalities.find(({ condition, matched }) => condition.operator === 'not_equals' ? !matched : matched)
    if (positive) return some([positive.condition.value])
    const allowed = choices.map(choice => Array.from({ length: choices.length }, (_, index) => index + 1).filter(rank => {
      const partial = Array.from({ length: choices.length }, () => undefined as string | undefined)
      partial[rank - 1] = choice
      return tests.filter(({ condition }) => !equalities.some(item => item.condition === condition)).every(({ condition, matched }) => {
        if ((condition.value as { choiceId?: string })?.choiceId !== choice) return true
        return evaluateCondition(condition, { [step.stableId]: partial }).matched === matched
      })
    }))
    return priorityIsPossible(choices, allowed, equalities.map(({ condition }) => condition.value as string[]))
  }
  if (['short_text', 'long_text', 'email'].includes(step.questionType ?? '')) {
    if (tests.length) {
      const positive = tests.find(({condition,matched}) => condition.operator === 'equals' ? matched : !matched)
      if (positive) return some([positive.condition.value])
      // Only equality/inequality predicates are admitted. Their finite excluded
      // classes leave a witness unless the configured length domain is empty.
      const length = Math.max(1,Number(settings.minLength ?? 0))
      const candidates = tests.map(({condition})=>String(condition.value))
      const alphabet = Array.from({length:tests.length+1},(_,i)=>String.fromCodePoint(0x61+i))
      return some([...candidates,...alphabet.map(char=>step.questionType==='email'?`${char}@b.c`:char.repeat(length))])
    }
    if (settings.pattern !== undefined || settings.inputMask !== undefined) throw new ConditionProofError('Exact answered-condition reachability for text with a pattern or mask is not supported yet.')
    if (step.questionType === 'email') return some(['a@b.c'])
    const length = Math.max(1, Number(settings.minLength ?? 0))
    return length <= Number(settings.maxLength ?? textTypeLimit(step.questionType)) && some(['x'.repeat(length)])
  }
  // Contact validators have no configurable domain restrictions and each admits
  // present values. Only blank/answered conditions are supported on these types.
  if ((contactQuestionTypes as readonly string[]).includes(step.questionType ?? '') && tests.length === 0) return true
  throw new ConditionProofError(`Exact answered-condition reachability is not supported for ${step.questionType ?? 'this screen'} yet.`)
}

/** Lazily distribute signed trees, pruning each operand's conjunction with its
 * exact answer-domain solver. Requirements retain the questions available when
 * their rule ran: a skipped answer cannot become present later in the path.
 */
export function conditionRequirementsPossible(questions: ReadonlyMap<string, ConditionQuestion>, requirements: ConditionRequirement[], visited: ReadonlySet<string>, budget: ConditionProofBudget = { remaining: 100_000 }, calculations:Calculation[] = []): boolean {
  const states = [{ pending: requirements.slice(), leaves: new Map<string, LeafRequirement[]>(), derived:[] as Array<LeafRequirement & {available:ReadonlySet<string>}> }]
  while (states.length) {
    const state = states.pop()!
    let possible = true
    while (state.pending.length && possible) {
      spendConditionProof(budget)
      const { condition, matched, available = visited } = state.pending.pop()!
      if (condition.kind === 'group') {
        const children = condition.conditions.map(child => ({ condition: child, matched, available }))
        if ((condition.join === 'and') === matched) state.pending.push(...children)
        else {
          for (const child of children) states.push({ pending: [...state.pending, child], leaves: new Map(state.leaves),derived:state.derived.slice() })
          possible = false
        }
      } else if (condition.stepId.startsWith('variable:')) state.derived.push({condition,matched,available})
      else if (!available.has(condition.stepId)) possible = evaluateCondition(condition, {}).matched === matched
      else {
        const question = questions.get(condition.stepId)
        if (!question) throw new ConditionProofError('A condition references a missing question.')
        const existing = state.leaves.get(condition.stepId) ?? []
        const known = existing.find(item => item.condition === condition)
        if (known) possible = known.matched === matched
        else {
          const next = [...existing, { condition, matched }]
          possible = localAnswerExists(question, next)
          state.leaves.set(condition.stepId, next)
        }
      }
    }
    if (possible && [...visited].every(id => {
      const question = questions.get(id)
      return !question || localAnswerExists(question, state.leaves.get(id) ?? [])
    }) && proveCalculatedConditions(calculations,questions,state.derived,state.leaves,visited,budget)) return true
  }
  return false
}
