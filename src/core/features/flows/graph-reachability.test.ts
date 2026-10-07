import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { answerIssue } from '../../shared/answers'
import type { BranchSelection } from '../../shared/flowPolicies'
import { resolveNextStep, validateRevisionGraph } from './graph'
import type { StoredBranchRule, StoredChoice, StoredStep } from './repository'

const now = '2026-10-07T00:00:00.000Z'
const question: StoredStep = { id: 'row-q', revisionId: 'revision', stableId: 'q', position: 0, kind: 'question', questionType: 'single_choice', prompt: 'Choose', helperText: null, required: true, nextStepStableId: 'default', questionSettingsJson: null, createdAt: now, updatedAt: now }
const completion = (stableId: string, position: number): StoredStep => ({ ...question, id: `row-${stableId}`, stableId, position, kind: 'completion', questionType: null, required: false, nextStepStableId: null })
const choicesFor = (ids: string[]): StoredChoice[] => ids.map((id, position) => ({ id: `row-${id}`, stepId: question.id, stableId: id, value: id, label: id, position, createdAt: now, updatedAt: now }))
type Predicate = [StoredBranchRule['predicateKind'], unknown]
const rulesFor = (predicates: Predicate[]): StoredBranchRule[] => predicates.map(([predicateKind, expectedValue], position) => ({ id: `rule-${position}`, revisionId: 'revision', sourceStepStableId: 'q', destinationStepStableId: `branch-${position}`, predicateKind, expectedValueJson: JSON.stringify(expectedValue), position, createdAt: now, updatedAt: now }))
const policies: BranchSelection[] = ['first-matching-rule', 'last-matching-rule']
const permutations = (values: string[]): string[][] => values.length ? values.flatMap((value) => permutations(values.filter((entry) => entry !== value)).map((rest) => [value, ...rest])) : [[]]
const subsets = (values: string[]): string[][] => values.reduce<string[][]>((sets, value) => [...sets, ...sets.map((set) => [...set, value])], [[]])

// This oracle uses every valid answer in each small domain and the actual
// respondent evaluator, independently of the constraint solver's reasoning.
function checkDomain(step: StoredStep, ids: string[], answers: unknown[], predicates: Predicate[]) {
  const options = choicesFor(ids), rules = rulesFor(predicates)
  const screens = [...rules.map((rule, index) => completion(rule.destinationStepStableId, index + 1)), completion('default', rules.length + 1)]
  const valid = answers.filter((value) => !answerIssue({ ...step, questionSettings: step.questionSettingsJson ? JSON.parse(step.questionSettingsJson) : null }, ids, value))
  expect(valid.length).toBeGreaterThan(0)
  for (const selection of policies) {
    const reached = new Set(valid.map((value) => resolveNextStep({ step, rules, answers: { q: value }, selection }).nextStepId))
    const expected = screens.filter((screen) => !reached.has(screen.stableId)).map((screen) => screen.stableId).sort()
    const issues = validateRevisionGraph([step, ...screens], options, rules, selection)
    expect(issues.filter((issue) => issue.reason.includes('reachable')).map((issue) => issue.stepId).sort(), JSON.stringify({ selection, predicates, step, expected })).toEqual(expected)
    expect(issues.filter((issue) => !issue.reason.includes('reachable'))).toEqual([])
  }
}

contract(['FLOW-006', 'FLOW-013'], 'rejects the precise completion hidden by a first- or last-match rule and exhaustively agrees with routing', () => {
  checkDomain(question, ['a', 'b'], ['a', 'b'], [['equals', 'a'], ['equals', 'a']])
  checkDomain(question, ['a', 'b'], ['a', 'b'], [['equals', 'a'], ['equals', 'b']])
  checkDomain({ ...question, required: false }, ['a', 'b'], ['a', 'b', undefined], [['equals', 'a'], ['equals', 'b']])
})

contract('FLOW-013', 'uses displayed rule positions even when a caller supplies shuffled rules', () => {
  const rules = rulesFor([['equals', 'a'], ['equals', 'a']])
  const steps = [question, completion('branch-0', 1), completion('branch-1', 2), completion('default', 3)]
  for (const selection of policies) {
    const winner = resolveNextStep({ step: question, rules, answers: { q: 'a' }, selection }).nextStepId
    const loser = rules.find((rule) => rule.destinationStepStableId !== winner)!.destinationStepStableId
    expect(validateRevisionGraph(steps, choicesFor(['a', 'b']), [rules[1], rules[0]], selection)).toEqual([{ stepId: loser, reason: 'Every published step must be reachable from the first screen.' }])
  }
})

contract('FLOW-013', 'accepts a valid conditional question and alternate completion without requiring every question on every path', () => {
  const next = { ...question, id: 'row-followup', stableId: 'followup', position: 1, questionType: 'short_text' as const, nextStepStableId: 'default' }
  const rules = rulesFor([['equals', 'a']]).map((rule) => ({ ...rule, destinationStepStableId: 'followup' }))
  expect(validateRevisionGraph([question, next, completion('default', 2)], choicesFor(['a', 'b']), rules)).toEqual([])
})

contract('FLOW-013', 'uses every rating operator over the configured integer domain, including impossible fractional and out-of-scale rules', () => {
  const step = { ...question, questionType: 'rating' as const, questionSettingsJson: JSON.stringify({ min: -2, max: 3 }) }
  const predicates: Predicate[] = [
    ['equals', 0], ['equals', 0.5], ['greater_than', 3], ['greater_than', -1],
    ['greater_than_or_equal', 1], ['less_than', 0], ['less_than_or_equal', 1], ['less_than_or_equal', -3],
  ]
  for (const first of predicates) for (const second of predicates) {
    checkDomain(step, [], [-2, -1, 0, 1, 2, 3], [first, second])
  }
})

contract('FLOW-013', 'combines any/all shadowing and selection counts exactly across every valid multiple-choice answer', () => {
  const ids = ['a', 'b', 'c', 'd']
  const predicates: Predicate[] = [['any_of', ['a']], ['all_of', ['a', 'b']], ['any_of', ['b', 'c']], ['all_of', ['c', 'd']], ['any_of', ids]]
  for (const [minSelections, maxSelections] of [[0, 0], [0, 2], [1, 1], [2, 3], [4, 4]]) {
    for (const first of predicates) for (const second of predicates) {
      checkDomain({ ...question, required: minSelections > 0, questionType: 'multiple_choice', questionSettingsJson: JSON.stringify({ minSelections, maxSelections }) }, ids, [...subsets(ids).filter((answer) => answer.length > 0), undefined], [first, second, ['all_of', ['a', 'd']]])
    }
  }
})

contract('FLOW-013', 'combines priority equality and all rank operators across every complete ordering', () => {
  const ids = ['a', 'b', 'c']
  const predicates: Predicate[] = [
    ['equals', ['a', 'b', 'c']], ['equals', ['b', 'a', 'c']],
    ['greater_than', { choiceId: 'a', rank: 1 }], ['greater_than_or_equal', { choiceId: 'b', rank: 2 }],
    ['less_than', { choiceId: 'c', rank: 3 }], ['less_than_or_equal', { choiceId: 'a', rank: 2 }],
  ]
  for (const first of predicates) for (const second of predicates) for (const required of [true, false]) {
    checkDomain({ ...question, questionType: 'priority', required }, ids, [...permutations(ids), undefined], [first, second, ['less_than_or_equal', { choiceId: 'c', rank: 1 }]])
  }
})

contract('FLOW-013', 'distinguishes dead declared cycles from possible cycles and visits all alternatives after a cycle', () => {
  const rules = rulesFor([['equals', 'a'], ['equals', 'a']])
  rules[1].destinationStepStableId = 'q'
  const steps = [question, completion('branch-0', 1), completion('default', 2)]
  expect(validateRevisionGraph(steps, choicesFor(['a', 'b']), rules)).toEqual([])
  const cyclic = validateRevisionGraph(steps, choicesFor(['a', 'b']), rules, 'last-matching-rule')
  expect(cyclic).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('cycle') }))
  expect(cyclic).not.toContainEqual(expect.objectContaining({ stepId: 'default', reason: expect.stringContaining('reachable') }))
  const covered = rulesFor([['equals', 'a'], ['equals', 'b']])
  const exhaustedDefault = [{ ...question, nextStepStableId: 'q' }, completion('branch-0', 1), completion('branch-1', 2)]
  expect(validateRevisionGraph(exhaustedDefault, choicesFor(['a', 'b']), covered)).toEqual([])
  expect(validateRevisionGraph([{ ...exhaustedDefault[0], required: false }, ...exhaustedDefault.slice(1)], choicesFor(['a', 'b']), covered)).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('cycle') }))
})

contract('FLOW-013', 'checks the configured 100-choice and ten-priority limits without enumerating answer sets', () => {
  const ids = Array.from({ length: 100 }, (_, index) => `c${index}`)
  const rules = rulesFor([['all_of', ids.slice(0, 51)]])
  const multiple = { ...question, questionType: 'multiple_choice' as const, questionSettingsJson: JSON.stringify({ minSelections: 50, maxSelections: 50 }) }
  expect(validateRevisionGraph([multiple, completion('branch-0', 1), completion('default', 2)], choicesFor(ids), rules)).toEqual([{ stepId: 'branch-0', reason: 'Every published step must be reachable from the first screen.' }])
  const priorityIds = ids.slice(0, 10)
  const priorityRules = rulesFor(priorityIds.map((choiceId) => ['greater_than', { choiceId, rank: 9 }]))
  const screens = priorityRules.map((rule, index) => completion(rule.destinationStepStableId, index + 1))
  expect(validateRevisionGraph([{ ...question, questionType: 'priority' }, ...screens, completion('default', 11)], choicesFor(priorityIds), priorityRules)).toEqual([{ stepId: 'default', reason: 'Every published step must be reachable from the first screen.' }])
})

contract('FLOW-012', 'rejects priority equality predicates containing duplicates or values outside a complete stable-choice ordering', () => {
  for (const answer of [['a', 'a'], ['a', 'b', 1]]) {
    expect(validateRevisionGraph([{ ...question, questionType: 'priority' }, completion('default', 1)], choicesFor(['a', 'b']), rulesFor([['equals', answer]]).map((rule) => ({ ...rule, destinationStepStableId: 'default' })))).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('predicate') }))
  }
})
