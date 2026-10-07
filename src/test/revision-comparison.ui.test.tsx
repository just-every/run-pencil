// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { reportingApi, type RevisionComparison as Comparison } from '../core/app/api'
import { RevisionComparison } from '../core/features/results/ui/RevisionComparison'

vi.mock('../core/app/api', async original => { const actual = await original<typeof import('../core/app/api')>(); return { ...actual, reportingApi: { ...actual.reportingApi, compareRevisions: vi.fn() } } })
beforeEach(() => vi.resetAllMocks())
afterEach(() => cleanup())
const question = { id: 'added', prompt: 'Added question', questionType: 'single_choice', reached: 2, dropped: 0, answered: 1, choices: [{ id: 'choice', label: 'Current answer' }], distribution: [{ value: 'choice', label: 'Current answer', count: 1 }], distributionLabel: 'One answer per response.' }
const report: Comparison = { flow: { id: 'flow', title: 'Visit review', slug: 'visit' }, revisions: [{ id: 'new', number: 2, isCurrent: 1 }, { id: 'old', number: 1, isCurrent: 0 }], questions: [{ id: question.id, answered: 1, eligibleResponses: 2, versions: [{ ...question, revisionId: 'new', eligibleResponses: 2 }] }] }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }

it('shows actual revision denominators and absence without assigning earlier unanswered responses', async () => {
  vi.mocked(reportingApi.compareRevisions).mockResolvedValue(report)
  render(<RevisionComparison flowId="flow" onClose={vi.fn()} />)
  const current = await screen.findByRole('region', { name: 'Revision 2: Added question' })
  expect(within(current).getByText('100% · 1 / 1 answers')).toBeInTheDocument()
  expect(screen.getByText('50% answered · 1 / 2 released responses from revisions containing this question')).toBeInTheDocument()
  expect(within(current).getByText('1 answered / 2 released responses in this revision')).toBeInTheDocument()
  const absent = screen.getByRole('region', { name: 'Revision 1: question absent' })
  expect(within(absent).getByText('Not in this revision')).toBeInTheDocument()
  expect(within(absent).queryByText(/answered|0%/)).not.toBeInTheDocument()
  expect(screen.getByText('Question identity')).toBeInTheDocument()
})

it('keeps a close path on failure and retries the same flow', async () => {
  const close = vi.fn()
  vi.mocked(reportingApi.compareRevisions).mockRejectedValueOnce(new Error('Comparison unavailable')).mockResolvedValue(report)
  render(<RevisionComparison flowId="flow" onClose={close} />)
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Close comparison' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry comparison' }))
  await screen.findByText('Not in this revision')
  expect(reportingApi.compareRevisions).toHaveBeenNthCalledWith(1, 'flow')
  expect(reportingApi.compareRevisions).toHaveBeenNthCalledWith(2, 'flow')
  fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }))
  expect(close).toHaveBeenCalledTimes(1)
})

it('ignores the old flow read after changing context and a late result after closing', async () => {
  const old = deferred<Comparison>(); const late = deferred<Comparison>()
  vi.mocked(reportingApi.compareRevisions).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...report, questions: [] }).mockReturnValueOnce(late.promise)
  const view = render(<RevisionComparison flowId="old" onClose={vi.fn()} />)
  view.rerender(<RevisionComparison flowId="new" onClose={vi.fn()} />)
  await act(async () => old.resolve(report))
  expect(screen.queryByText('Added question')).not.toBeInTheDocument()
  view.rerender(<RevisionComparison flowId="last" onClose={vi.fn()} />)
  view.unmount()
  await act(async () => late.resolve(report))
  expect(vi.mocked(reportingApi.compareRevisions).mock.calls).toEqual([['old'], ['new'], ['last']])
})
