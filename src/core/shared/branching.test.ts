import { contract } from '../../test/contract'
import { expect, it } from 'vitest'
import { matchesBranch } from './branching'
import { answerIssue } from './answers'
import { dayBoundary, zonedInstant } from './timeZone'
it('distinguishes exact priority order and ranks a chosen option rather than comparing whole arrays', () => {
  expect(matchesBranch({ predicateKind: 'equals', expectedValue: ['a', 'b'] }, ['a', 'b'])).toBe(true)
  expect(matchesBranch({ predicateKind: 'equals', expectedValue: ['a', 'b'] }, ['b', 'a'])).toBe(false)
  expect(matchesBranch({ predicateKind: 'less_than_or_equal', expectedValue: { choiceId: 'b', rank: 2 } }, ['a', 'b', 'c'])).toBe(true)
  expect(matchesBranch({ predicateKind: 'less_than_or_equal', expectedValue: { choiceId: 'missing', rank: 2 } }, ['a', 'b'])).toBe(false)
})
contract(['RESP-003'], 'rejects fractional ratings, duplicate choices, incomplete priorities and invalid email before advancing', () => {
  const q = { prompt: 'Question', required: true, questionSettings: null }
  expect(answerIssue({ ...q, questionType: 'rating' }, [], 1.5)).toBeTruthy()
  expect(answerIssue({ ...q, questionType: 'multiple_choice' }, ['a', 'b'], ['a', 'a'])).toBeTruthy()
  expect(answerIssue({ ...q, questionType: 'priority' }, ['a', 'b'], ['a'])).toBeTruthy()
  expect(answerIssue({ ...q, questionType: 'email' }, [], 'a@localhost')).toBeTruthy()
  expect(answerIssue({ ...q, questionType: 'long_text' }, [], ' exact\ntext ')).toBeUndefined()
})
contract(['WS-001'], 'uses workspace midnight across a DST transition and rejects impossible or ambiguous wall times', () => {
  expect(dayBoundary('2026-10-04', 'Australia/Sydney')).toBe('2026-10-03T14:00:00.000Z')
  expect(dayBoundary('2026-10-04', 'Australia/Sydney', true)).toBe('2026-10-04T12:59:59.999Z')
  expect(() => zonedInstant('2026-10-04T02:30', 'Australia/Sydney')).toThrow(/does not exist/)
  expect(() => zonedInstant('2026-04-05T02:30', 'Australia/Sydney')).toThrow(/twice/)
  expect(zonedInstant('2026-10-02T09:00', 'Australia/Brisbane')).toBe('2026-10-01T23:00:00.000Z')
})
contract(['WS-001'], 'rejects invalid calendar input and the half-hour DST overlap in Lord Howe', () => {
  expect(() => zonedInstant('2026-02-30T09:00', 'UTC')).toThrow(/valid calendar/)
  expect(() => zonedInstant('2026-04-05T01:45', 'Australia/Lord_Howe')).toThrow(/twice/)
})
