// @vitest-environment jsdom
import { contract } from './contract'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { QuestionResults } from '../core/features/results/ui/QuestionResults'
import type { QuestionReport } from '../core/app/api'
const question: QuestionReport = { importedAnswered: 0, summary: {}, id: 'question', prompt: 'How was the visit?', questionType: 'single_choice', reached: 3, dropped: 1, answered: 1, choices: [{ id: 'choice', label: 'Good' }], distribution: [{ value: 'choice', label: 'Good', count: 1 }], distributionLabel: 'One answer per response.' }
afterEach(cleanup)
contract(['RSLT-002', 'RSLT-003'], 'states different session drop-off and released-answer denominators without inventing unanswered abandoned answers', () => {
  render(<QuestionResults flowId="flow" questions={[question]} />)
  expect(screen.getByText('3 distinct sessions reached · 1 expired sessions ended here · 33% drop-off (1 / 3 reached sessions)')).toBeInTheDocument()
  expect(screen.getByText('1 of 1 answer · 100%')).toBeInTheDocument()
  expect(screen.getByText(/Released answers exclude quarantine and erased responses/)).toBeInTheDocument()
  expect(screen.getByText(/active sessions remain pending/)).toBeInTheDocument()
})
it.each([{ reached: 30, answered: 32, dropped: 1 }, { reached: 1, answered: 0, dropped: 2 }, { reached: 30, answered: 29, dropped: 2 }])('names contradictory historical metrics as unavailable instead of clamping or showing an impossible rate', metrics => {
  render(<QuestionResults flowId="flow" questions={[{ ...question, ...metrics, distribution: [] }]} />)
  expect(screen.getByRole('alert')).toHaveTextContent('retained counters contradict the saved response evidence')
  expect(screen.queryByText(/% drop-off/)).not.toBeInTheDocument()
  expect(screen.queryByText(/distinct sessions reached/)).not.toBeInTheDocument()
  expect(screen.getByText(new RegExp(`^${metrics.answered} answers$`))).toBeInTheDocument()
})
contract(['RSLT-002', 'RSLT-003'], 'uses an explicit zero denominator for a question no session reached', () => {
  render(<QuestionResults flowId="flow" questions={[{ ...question, reached: 0, dropped: 0, answered: 0, distribution: [] }]} />)
  expect(screen.getByText('0 distinct sessions reached · 0 expired sessions ended here · 0% drop-off (0 / 0 reached sessions)')).toBeInTheDocument()
})

contract(['RSLT-002', 'RSLT-003'], 'keeps disjoint answered and dropped cohorts available at the exact reached boundary', () => {
  render(<QuestionResults flowId="flow" questions={[{ ...question, reached: 30, answered: 28, dropped: 2, distribution: [] }]} />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('30 distinct sessions reached · 2 expired sessions ended here · 7% drop-off (2 / 30 reached sessions)')).toBeInTheDocument()
  expect(screen.getByText(/^28 answers$/)).toBeInTheDocument()
})
contract(['RSLT-002', 'RSLT-003', 'RSLT-005'], 'keeps imported answers in shares without inventing native sessions or false contradictory metrics', () => {
  render(<QuestionResults flowId="flow" questions={[{ ...question, reached: 4, dropped: 1, answered: 5, importedAnswered: 2, distribution: [{ value: 'choice', label: 'Good', count: 3 }] }]} />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('4 distinct sessions reached · 1 expired sessions ended here · 25% drop-off (1 / 4 reached sessions)')).toBeInTheDocument()
  expect(screen.getByText('3 of 5 answers · 60%')).toBeInTheDocument()
  expect(screen.getByText('2 answers imported')).toBeInTheDocument()
})
contract(['RSLT-002', 'RSLT-003'], 'shows imported-only answer evidence and zero actual session denominator', () => {
  render(<QuestionResults flowId="flow" questions={[{ ...question, reached: 0, dropped: 0, answered: 2, importedAnswered: 2, distribution: [{ value: 'choice', label: 'Good', count: 2 }] }]} />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('0 distinct sessions reached · 0 expired sessions ended here · 0% drop-off (0 / 0 reached sessions)')).toBeInTheDocument()
  expect(screen.getByText('2 of 2 answers · 100%')).toBeInTheDocument()
  expect(screen.getByText('2 answers imported')).toBeInTheDocument()
})
