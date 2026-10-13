import { templateStructure } from '../features/flows/templates'
import { publicSteps } from '../features/flows/serialization'
import { expect } from 'vitest'
import { contract } from '../../test/contract'
import { answerIssue } from './answers'
import { calendarDate, typeSettingsValid } from './questionTypes'
import { matchesBranch } from './branching'
const question = { prompt: 'Question', required: true, questionSettings: null }
contract(['FLOW-003', 'FLOW-019', 'RESP-003'], 'validates every new answer boundary without coercing primitives', () => {
  const check = (type: Parameters<typeof answerIssue>[0]['questionType'], value: unknown, valid: boolean, settings = {}) => expect(!answerIssue({ ...question, questionType: type, questionSettings: settings }, ['a'], value)).toBe(valid)
  check('dropdown', 'a', true); check('dropdown', 'unknown', false); check('dropdown', ['a'], false)
  for (const value of [true, false]) check('yes_no', value, true)
  for (const value of [0, 10]) check('nps', value, true)
  for (const value of [-1, 11, 0.5, '0', false, Infinity, null]) check('nps', value, false)
  for (const value of [-2, -1.25, 0, 1.25, 2]) check('number', value, true, { min: -2, max: 2, decimalPlaces: 2 })
  for (const value of [-3, 3, 1.001, '0', Infinity, NaN]) check('number', value, false, { min: -2, max: 2, decimalPlaces: 2 })
  check('date', '0001-01-01', true); check('date', '9999-12-31', true); check('date', '0000-01-01', false); check('date', '2024-02-29', true); check('date', '2024-02-28', false, { earliest: '2024-02-29' }); check('date', '2023-02-29', false); check('date', '2024-02-30', false); check('date', '2024-03-01', false, { latest: '2024-02-29' })
  check('consent', true, true, { statement: 'I agree.' }); check('consent', false, false, { statement: 'I agree.' }); check('consent', 'true', false, { statement: 'I agree.' })
  expect(answerIssue({ ...question, questionType: 'consent', required: false, questionSettings: { statement: 'I agree.' } }, [], false)).toBeUndefined()
  expect(answerIssue({ ...question, questionType: 'dropdown' }, ['stable-a'], 'a')).toBeTruthy()
  check('number', 1e-7, true, { decimalPlaces: 7 }); check('number', 1e-7, false, { decimalPlaces: 6 }); check('number', 0, true, { min: 0, max: 0, decimalPlaces: 0 }); check('number', 0.1, false, { decimalPlaces: 0 })
  for (const type of ['dropdown', 'yes_no', 'nps', 'number', 'date', 'consent'] as const) check(type, undefined, false, type === 'consent' ? { statement: 'I agree.' } : {})
})
contract(['FLOW-003', 'FLOW-005'], 'rejects hostile configuration and compares dates as calendar strings', () => {
  expect(calendarDate('1900-02-29')).toBe(false); expect(calendarDate('2000-02-29')).toBe(true)
  for (const type of ['dropdown', 'yes_no', 'nps', 'number', 'date', 'consent']) for (const config of [true, [], 'hostile', null]) expect(typeSettingsValid(type, config as never)).toBe(false)
  expect(typeSettingsValid('number', { min: '0' })).toBe(false); expect(typeSettingsValid('number', { decimalPlaces: -1 })).toBe(false)
  expect(typeSettingsValid('date', { earliest: '2025-01-01', latest: '2024-01-01' })).toBe(false)
  expect(typeSettingsValid('consent', { statement: false })).toBe(false)
  expect(matchesBranch({ predicateKind: 'less_than', expectedValue: '2024-03-01' }, '2024-02-29')).toBe(true)
  expect(matchesBranch({ predicateKind: 'equals', expectedValue: false }, false)).toBe(true)
})

contract('FLOW-003', 'uses dedicated NPS in new templates without reinterpreting old rating snapshots', () => {
  const template = templateStructure('nps', 'revision', '2026-10-08T00:00:00Z')
  expect(template.steps.map(step => step.questionType)).toEqual(['nps', 'long_text', null])
  expect(JSON.parse(template.steps[0].questionSettingsJson!)).toEqual({ lowLabel: 'Not at all likely', highLabel: 'Extremely likely' })
  const old = { ...template.steps[0], questionType: 'rating' as const, questionSettingsJson: JSON.stringify({ min: 0, max: 10 }) }
  expect(publicSteps([old])[0]).toMatchObject({ id: old.stableId, questionType: 'rating', questionSettings: { min: 0, max: 10 } })
  expect(old.questionSettingsJson).toBe('{"min":0,"max":10}')
})
