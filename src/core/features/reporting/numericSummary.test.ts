import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { summarizeAnswers } from './answerSummary'

contract(['RSLT-001', 'FLOW-019'], 'number summaries keep finite bounds and medians for extreme and subnormal answers', () => {
  const cases: Array<[number[], { minimum: number; median: number; maximum: number }]> = [
    [[1e308, 1e308], { minimum: 1e308, median: 1e308, maximum: 1e308 }],
    [[-1e308, -1e308], { minimum: -1e308, median: -1e308, maximum: -1e308 }],
    [[-1e308, 1e308], { minimum: -1e308, median: 0, maximum: 1e308 }],
    [[5e-324, 1e-323], { minimum: 5e-324, median: 1e-323, maximum: 1e-323 }],
    [[5e-324, 5e-324], { minimum: 5e-324, median: 5e-324, maximum: 5e-324 }],
    [[1, 2, 3], { minimum: 1, median: 2, maximum: 3 }],
    [[1, 2, 3, 4], { minimum: 1, median: 2.5, maximum: 4 }],
  ]

  for (const [values, expected] of cases) expect(summarizeAnswers('number', values, [])).toEqual(expected)
})

contract(['RSLT-001', 'FLOW-019'], 'number summaries reject nonfinite retained answers', () => {
  for (const value of [Infinity, -Infinity, NaN]) {
    expect(() => summarizeAnswers('number', [value], [])).toThrow('Invalid stored numeric answer')
  }
})
