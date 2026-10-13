// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { ResponseLedger } from '../core/features/results/ui/ResponseLedger'
import { reportingApi, type Ledger, type QuestionReport } from '../core/app/api'

vi.mock('../core/app/api', async original => { const actual = await original<typeof import('../core/app/api')>(); return { ...actual, reportingApi: { ...actual.reportingApi, ledger: vi.fn() } } })
afterEach(() => { cleanup(); vi.resetAllMocks() })
const question = (questionType: string): QuestionReport => ({ id: questionType, prompt: `Question ${questionType}`, questionType, importedAnswered: 0, reached: 1, dropped: 0, answered: 1, choices: [], distribution: [], distributionLabel: '', summary: {} })
const ledger: Ledger = { flow: { id: 'flow', title: 'Study', slug: 'study' }, cutoff: '2024-02-29T10:00:00Z', filter: {}, revisions: [], total: 1, responses: [{ id: 'response', revisionId: 'revision', revisionNumber: 3, source: 'direct', startedAt: null, completedAt: '2024-02-29T10:00:00Z', releasedAt: '2024-02-29T10:00:00Z', answers: [], omittedQuestions: [] }] }

contract(['LEDG-001', 'LEDG-003', 'WS-001'], 'ledger mainlines contain date/time and source while revision details remain behind the separate answers button', async () => {
  vi.mocked(reportingApi.ledger).mockResolvedValue(ledger)
  render(<ResponseLedger flowId="flow" revisionId="revision" timeZone="UTC" questions={[]} onChanged={vi.fn()} />)
  const button = await screen.findByRole('button', { name: 'View answers' })
  const article = button.closest('article')!
  const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(ledger.responses[0].completedAt))
  expect(article.querySelector('p')).toHaveTextContent(`${formatted} · Direct link`)
  expect(article.querySelector('p')?.textContent).toBe(`${formatted} · Direct link`)
  expect(screen.queryByText('Revision 3')).not.toBeInTheDocument()
  fireEvent.click(button)
  expect(screen.getByText('Revision 3')).toBeInTheDocument()
  expect(button).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(button)
  expect(screen.queryByText('Revision 3')).not.toBeInTheDocument()
})

contract('LEDG-003', 'boolean filters offer explicit decisions and typed fields preserve zero, calendar strings and stable dropdown IDs', async () => {
  vi.mocked(reportingApi.ledger).mockResolvedValue(ledger)
  const questions = ['yes_no', 'consent', 'number', 'date', 'nps', 'dropdown'].map(question)
  questions[5].choices = [{ id: 'stable-choice', label: 'Coffee' }]
  render(<ResponseLedger flowId="flow" revisionId="revision" timeZone="Pacific/Honolulu" questions={questions} onChanged={vi.fn()} />)
  await screen.findByRole('button', { name: 'View answers' })
  for (const [type, labels] of [['yes_no', ['Any value', 'Yes', 'No']], ['consent', ['Any value', 'Accepted', 'Declined']]] as const) {
    fireEvent.change(screen.getByLabelText('Structured question'), { target: { value: type } })
    const input = screen.getByRole('combobox', { name: 'Answer contains / equals' })
    expect([...input.querySelectorAll('option')].map(option => option.textContent)).toEqual(labels)
    for (const value of ['true', 'false']) {
      fireEvent.change(input, { target: { value } })
      await waitFor(() => expect(reportingApi.ledger).toHaveBeenLastCalledWith('flow', { revisionId: 'revision', offset: 0, answerStepId: type, answerValue: value }))
    }
  }
  for (const [type, value, inputType] of [['number', '0', 'number'], ['nps', '0', 'number'], ['date', '2024-02-29', 'date'], ['dropdown', 'stable-choice', null]]) {
    fireEvent.change(screen.getByLabelText('Structured question'), { target: { value: type } })
    const input = screen.getByLabelText('Answer contains / equals')
    if (inputType) expect(input).toHaveAttribute('type', inputType)
    fireEvent.change(input, { target: { value } })
    await waitFor(() => expect(reportingApi.ledger).toHaveBeenLastCalledWith('flow', { revisionId: 'revision', offset: 0, answerStepId: type, answerValue: value }))
  }
})
