import { expect } from 'vitest'
import { contract } from '../../test/contract'
import { answerIssue, type AnswerQuestion } from './answers'
import { matchesBranch } from './branching'

contract('FLOW-019', 'validates exact typed answer boundaries without normalizing entered values', () => {
  const check = (questionType: AnswerQuestion['questionType'], value: unknown, valid: boolean, questionSettings: Record<string, unknown> = {}) => {
    const issue = answerIssue({ prompt: 'Question', questionType, required: true, questionSettings }, ['a', 'b', 'c'], value)
    expect(issue === undefined, `${questionType}: ${JSON.stringify(value)}`).toBe(valid)
  }
  for (const [type, limit] of [['short_text', 200], ['long_text', 5000]] as const) {
    check(type, 'x'.repeat(limit), true); check(type, 'x'.repeat(limit + 1), false)
    for (const value of [false, 1, {}, [], null, '']) check(type, value, false)
  }
  check('email', 'Mixed.Case@Example.org', true); check('email', 'bad@', false)
  for (const value of ['a', 'b', 'c']) check('single_choice', value, true)
  for (const value of ['unknown', ['a'], true]) check('single_choice', value, false)
  check('multiple_choice', ['a', 'c'], true, { minSelections: 2, maxSelections: 2 })
  for (const value of [['a'], ['a', 'b', 'c'], ['a', 'a'], ['a', 'foreign'], 'a']) check('multiple_choice', value, false, { minSelections: 2, maxSelections: 2 })
  for (const value of [0, 3, 10]) check('rating', value, true, { min: 0, max: 10 })
  for (const value of [-1, 11, 1.5, '5', NaN, Infinity]) check('rating', value, false, { min: 0, max: 10 })
  check('priority', ['c', 'a', 'b'], true)
  for (const value of [['a'], ['a', 'a', 'c'], ['a', 'b', 'foreign'], 'abc']) check('priority', value, false)
})

contract('FLOW-005', 'evaluates equality, every ordered predicate and stable-choice any/all without coercion', () => {
  expect(matchesBranch({ predicateKind: 'equals', expectedValue: 'a' }, 'a')).toBe(true)
  expect(matchesBranch({ predicateKind: 'equals', expectedValue: 'a' }, 'b')).toBe(false)
  for (const [predicateKind, yes, no] of [['greater_than', 4, 3], ['greater_than_or_equal', 3, 2], ['less_than', 2, 3], ['less_than_or_equal', 3, 4]] as const) {
    expect(matchesBranch({ predicateKind, expectedValue: 3 }, yes)).toBe(true)
    expect(matchesBranch({ predicateKind, expectedValue: 3 }, no)).toBe(false)
    expect(matchesBranch({ predicateKind, expectedValue: 3 }, String(yes))).toBe(false)
    expect(matchesBranch({ predicateKind, expectedValue: { choiceId: 'x', rank: 3 } }, Array.from({ length: 4 }, (_, i) => i + 1 === yes ? 'x' : String(i)))).toBe(true)
  }
  expect(matchesBranch({ predicateKind: 'equals', expectedValue: ['a', 'b'] }, ['a', 'b'])).toBe(true)
  expect(matchesBranch({ predicateKind: 'equals', expectedValue: ['a', 'b'] }, ['b', 'a'])).toBe(false)
  expect(matchesBranch({ predicateKind: 'any_of', expectedValue: ['a', 'b'] }, ['c', 'b'])).toBe(true)
  expect(matchesBranch({ predicateKind: 'any_of', expectedValue: ['a', 'b'] }, ['c'])).toBe(false)
  expect(matchesBranch({ predicateKind: 'all_of', expectedValue: ['a', 'b'] }, ['b', 'a', 'c'])).toBe(true)
  expect(matchesBranch({ predicateKind: 'all_of', expectedValue: ['a', 'b'] }, ['a'])).toBe(false)
})
