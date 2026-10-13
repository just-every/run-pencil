import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { summarizeAnswers } from './answerSummary'
import { composeQuestionReports } from './questionReport'
contract(['RSLT-001', 'RSLT-002', 'RSLT-005'], 'summarizes all answer types with exact boundary and revision denominators', () => {
  const choices = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
  for (const type of ['short_text', 'long_text', 'email']) expect(summarizeAnswers(type, ['Newest', '', 'Oldest'], [])).toEqual({ texts: ['Newest', '', 'Oldest'] })
  expect(summarizeAnswers('rating', [1, 5], [])).toEqual({ average: 3 })
  expect(summarizeAnswers('number', [-4, 2, 9, 10], [])).toEqual({ minimum: -4, median: 5.5, maximum: 10 })
  expect(summarizeAnswers('number', [7], [])).toEqual({ minimum: 7, median: 7, maximum: 7 })
  expect(summarizeAnswers('nps', [0, 6, 7, 8, 9, 10], [])).toEqual({ score: 0, promoters: 2, detractors: 2, passives: 2 })
  expect(summarizeAnswers('nps', [10], []).score).toBe(100)
  expect(summarizeAnswers('nps', [0], []).score).toBe(-100)
  expect(summarizeAnswers('date', ['2024-02-29', '2023-01-01'], [])).toEqual({ earliest: '2023-01-01', latest: '2024-02-29' })
  expect(() => summarizeAnswers('date', ['2023-02-29'], [])).toThrow()
  expect(() => summarizeAnswers('nps', [11], [])).toThrow()
  expect(summarizeAnswers('priority', [['a', 'b'], ['b', 'a']], choices).positions).toEqual(choices.map(choice => ({ ...choice, average: 1.5 })))
  for (const type of ['rating', 'nps', 'number', 'date']) expect(summarizeAnswers(type, [], [])).toEqual({})
  for (const type of ['single_choice', 'multiple_choice', 'dropdown', 'yes_no', 'consent']) {
    const values = type === 'multiple_choice' ? [['a', 'b']] : type === 'yes_no' ? [true] : type === 'consent' ? [{ accepted: true, statement: 'Consent text' }] : ['a']
    const reports = composeQuestionReports([{ revisionId: 'new', id: 'q', prompt: 'Question', questionType: type, position: 0, reached: 1, dropped: 0 }], values.map(value => ({ source: 'direct', revisionId: 'new', stepId: 'q', valueJson: JSON.stringify(value) })), choices.map(choice => ({ ...choice, revisionId: 'new', stepId: 'q' })))
    expect(reports[0].answered).toBe(1)
    expect(reports[0].distribution[0].count).toBe(1)
    if (type === 'multiple_choice') expect(reports[0].distribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2)
    expect(reports).toHaveLength(1)
  }
})
