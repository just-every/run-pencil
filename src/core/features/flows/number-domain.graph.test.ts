import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { answerIssue } from '../../shared/answers'
import type { BranchSelection } from '../../shared/flowPolicies'
import { resolveNextStep, validateRevisionGraph } from './graph'
import { reachableDestinations } from './reachable-destinations'
import type { StoredBranchRule, StoredStep } from './repository'

const question: StoredStep = { id: 'row-q', stableId: 'q', revisionId: 'r', position: 0, kind: 'question', questionType: 'number', prompt: 'Number', required: true, helperText: null, nextStepStableId: 'default', questionSettingsJson: null, createdAt: '', updatedAt: '' }
const completion = (stableId: string, position: number): StoredStep => ({ ...question, id: stableId, stableId, position, kind: 'completion', questionType: null, required: false, nextStepStableId: null })
type Predicate = [StoredBranchRule['predicateKind'], number]
const rulesFor = (predicates: Predicate[]): StoredBranchRule[] => predicates.map(([predicateKind, value], position) => ({ id: `rule-${position}`, revisionId: 'r', sourceStepStableId: 'q', destinationStepStableId: `branch-${position}`, predicateKind, expectedValueJson: JSON.stringify(value), position, createdAt: '', updatedAt: '' }))
const policies: BranchSelection[] = ['first-matching-rule', 'last-matching-rule']

function checkDomain(settings: Record<string, unknown>, answers: number[], predicates: Predicate[]) {
  const step = { ...question, questionSettingsJson: JSON.stringify(settings) }
  const rules = rulesFor(predicates)
  const screens = [...rules.map((rule, index) => completion(rule.destinationStepStableId, index + 1)), completion('default', rules.length + 1)]
  const valid = answers.filter(answer => !answerIssue({ ...step, questionSettings: settings }, [], answer))
  expect(valid.length).toBeGreaterThan(0)
  for (const selection of policies) {
    const reached = new Set(valid.map(answer => resolveNextStep({ step, rules, answers: { q: answer }, selection }).nextStepId))
    const context = JSON.stringify({ settings, predicates, selection })
    expect(reachableDestinations(step, [], settings, rules, selection).sort(), context).toEqual([...reached].sort())
    expect(validateRevisionGraph([step, ...screens], [], rules, selection), context).toEqual(screens.filter(screen => !reached.has(screen.stableId)).map(screen => ({ stepId: screen.stableId, reason: 'Every published step must be reachable from the first screen.' })))
  }
}

// Enumerate every IEEE754 value in a small closed interval independently of
// the candidate generator. Endpoints are exact, including zero and extremes.
function floatWindow(center: number) {
  const view = new DataView(new ArrayBuffer(8))
  const next = (value: number, direction: -1 | 1) => {
    if (value === 0) return direction * Number.MIN_VALUE
    view.setFloat64(0, value)
    view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction * (value > 0 ? 1 : -1)))
    return view.getFloat64(0)
  }
  const values = [center]
  for (const direction of [-1, 1] as const) {
    let value = center
    for (let i = 0; i < 4; i++) {
      value = next(value, direction)
      if (!Number.isFinite(value)) break
      values.push(value)
    }
  }
  return values.sort((a, b) => a - b)
}

contract(['FLOW-005', 'FLOW-019', 'RESP-003'], 'publishes strict branches reached by accepted large numbers at every configured precision', () => {
  for (let decimalPlaces = 0; decimalPlaces <= 15; decimalPlaces++) {
    for (const [threshold, answer, predicate] of [[1e20, 1e20 + 16384, 'greater_than'], [-1e20, -1e20 - 16384, 'less_than']] as const) {
      const settings = threshold > 0 ? { min: 0, decimalPlaces } : { max: 0, decimalPlaces }
      const step = { ...question, questionSettingsJson: JSON.stringify(settings) }
      const rules = rulesFor([[predicate, threshold]])
      expect(answerIssue({ ...step, questionSettings: settings }, [], answer)).toBeUndefined()
      expect(resolveNextStep({ step, rules, answers: { q: answer } }).nextStepId).toBe('branch-0')
      for (const selection of policies) {
        expect(reachableDestinations(step, [], settings, rules, selection)).toEqual(['branch-0', 'default'])
        expect(validateRevisionGraph([step, completion('branch-0', 1), completion('default', 2)], [], rules, selection)).toEqual([])
      }
    }
  }
})

contract(['FLOW-005', 'FLOW-019'], 'agrees with every float in bounded domains across sign, precision, spacing changes and finite extremes', () => {
  for (let decimalPlaces = 0; decimalPlaces <= 15; decimalPlaces++) {
    const spacingTransition = 2 ** Math.ceil(52 - decimalPlaces * Math.log2(10))
    for (const center of [0, 0.05, -0.05, 8, -8, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, spacingTransition, -spacingTransition, 1e20, -1e20, 1e308, -1e308, Number.MAX_VALUE, -Number.MAX_VALUE]) {
      const answers = floatWindow(center), min = answers[0], max = answers.at(-1)!
      const settings = { min, max, decimalPlaces }
      if (answers.every(answer => answerIssue({ ...question, questionSettings: settings }, [], answer))) continue
      for (const predicates of [
        [['equals', center], ['greater_than', center], ['less_than', center]],
        [['less_than_or_equal', min], ['greater_than_or_equal', max], ['greater_than', min]],
        [['greater_than_or_equal', center], ['less_than_or_equal', center]],
        [['greater_than', max], ['less_than', min], ['equals', center]],
        [['equals', center], ['equals', center]],
      ] as Predicate[][]) checkDomain(settings, answers, predicates)
    }
  }
})

contract(['FLOW-005', 'FLOW-019'], 'uses exact decimal neighbors in strict intervals and preserves first and last rule precedence', () => {
  for (const sign of [-1, 1]) {
    const answers = Array.from({ length: 9 }, (_, index) => sign * (index + 1) / 100).sort((a, b) => a - b)
    const settings = { min: answers[0], max: answers.at(-1), decimalPlaces: 2 }
    const lower = sign > 0 ? 0.035 : -0.065, upper = sign > 0 ? 0.065 : -0.035
    checkDomain(settings, answers, [['less_than_or_equal', lower], ['greater_than_or_equal', upper], ['greater_than', lower]])
    checkDomain(settings, answers, [['greater_than', answers[2]], ['less_than', answers[6]], ['equals', answers[4]]])
  }
  // This decimal boundary cannot be multiplied or divided by a binary
  // quantum exactly; its nearest valid answer still occupies the open cell.
  checkDomain({ min: 0.06, max: 0.08, decimalPlaces: 2 }, [0.06, 0.07, 0.08], [['less_than_or_equal', 0.06], ['greater_than_or_equal', 0.08], ['greater_than', 0.06]])
})

contract(['FLOW-005', 'FLOW-019'], 'agrees with exhaustive decimal grids at every configured precision', () => {
  for (let decimalPlaces = 0; decimalPlaces <= 15; decimalPlaces++) {
    for (const units of [0n, 7n, -7n, 999n, -999n, 9007199254740991n, -9007199254740991n]) {
      const answers = [...new Set(Array.from({ length: 9 }, (_, index) => Number(`${units + BigInt(index - 4)}e-${decimalPlaces}`)))].sort((a, b) => a - b)
      const min = answers[0], max = answers.at(-1)!, center = answers[Math.floor(answers.length / 2)]
      checkDomain({ min, max, decimalPlaces }, answers, [['less_than_or_equal', min], ['greater_than_or_equal', max], ['greater_than', min]])
      checkDomain({ min, max, decimalPlaces }, answers, [['equals', center], ['greater_than', center], ['less_than', center]])
    }
  }
})

contract(['FLOW-005', 'FLOW-019', 'RESP-003'], 'keeps zero unanswered until entered and refuses paths with no valid finite or precise answer', () => {
  const settings = { min: 0, max: 0, decimalPlaces: 0 }
  expect(answerIssue({ ...question, questionSettings: settings }, [], undefined)).toBeDefined()
  expect(answerIssue({ ...question, questionSettings: settings }, [], 0)).toBeUndefined()
  checkDomain(settings, [0], [['greater_than', 0], ['less_than', 0], ['equals', 0]])
  for (const value of [NaN, Infinity, -Infinity, 0.001, -1, 1]) expect(answerIssue({ ...question, questionSettings: settings }, [], value)).toBeDefined()
  checkDomain({ min: 0, max: 1, decimalPlaces: 2 }, [0, 0.5, 1], [['equals', 0.001], ['greater_than', 1], ['less_than', 0]])
  checkDomain({ min: 0, max: Number.MIN_VALUE }, [0, Number.MIN_VALUE], [['greater_than', 0]])
  checkDomain({ min: 0, max: Number.MIN_VALUE, decimalPlaces: 15 }, [0, Number.MIN_VALUE], [['equals', Number.MIN_VALUE]])
  for (const value of [0, 1e20, -1e20, Number.MAX_VALUE, -Number.MAX_VALUE]) {
    checkDomain({ min: value, max: value, decimalPlaces: 0 }, [value], [['greater_than', value], ['less_than', value], ['greater_than_or_equal', value], ['less_than_or_equal', value], ['equals', value]])
  }
})
