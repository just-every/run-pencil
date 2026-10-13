import { contract } from './contract'
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../core/app/api'
import { brandApi } from '../core/features/brand/api'
import { neutralBrand } from '../core/features/brand/brand'
import { DraftPreview } from '../core/features/flows/ui/DraftPreview'
import { draft } from './ui-fixtures'

vi.mock('../core/app/api', async original => {
  const actual = await original<typeof import('../core/app/api')>()
  return { ...actual, api: Object.fromEntries(Object.keys(actual.api).map(key => [key, vi.fn()])) }
})
vi.mock('../core/features/brand/api', () => ({ brandApi: { get: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks(); vi.mocked(brandApi.get).mockResolvedValue(neutralBrand) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const trace = { preview: true as const, draftVersion: 1, complete: true, screens: [{ stepId: 'question', evaluations: [], selectedRuleId: null, nextStepId: 'completion' }, { stepId: 'completion', evaluations: [], selectedRuleId: null, nextStepId: null }] }

contract(['FLOW-007'], 'identifies preview, waits for its matching draft evaluation and produces no respondent effects', async () => {
  const inspection = deferred<typeof trace>()
  vi.mocked(api.previewDraft).mockReturnValue(inspection.promise)
  render(<DraftPreview draft={draft} onClose={vi.fn()} onReload={vi.fn()} />)
  expect(screen.getByText('Preview', { exact: true })).toBeInTheDocument()
  expect(screen.getByText('Try your questions here. Preview answers are not collected.')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Draft preview' })).not.toHaveTextContent(/draft v\d+/i)
  fireEvent.change(screen.getByLabelText('How can we improve?'), { target: { value: 'Synthetic test answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue preview' }))
  expect(screen.queryByText('Preview complete')).not.toBeInTheDocument()
  expect(screen.getByLabelText('How can we improve?')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Continue preview' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Checking path…' })).toBeDisabled()
  await act(async () => inspection.resolve(trace))
  await screen.findByText('Preview complete')
  expect(api.previewDraft).toHaveBeenCalledWith('flow', { question: 'Synthetic test answer' })
  expect(api.startSession).not.toHaveBeenCalled(); expect(api.advanceSession).not.toHaveBeenCalled(); expect(api.submitResponse).not.toHaveBeenCalled()
})

it('preserves test answers on a failed read and retries without advancing to completion', async () => {
  vi.mocked(api.previewDraft).mockRejectedValueOnce(new Error('Preview temporarily unavailable')).mockResolvedValue(trace)
  render(<DraftPreview draft={draft} onClose={vi.fn()} onReload={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('How can we improve?'), { target: { value: 'Keep preview input' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue preview' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('How can we improve?')).toHaveValue('Keep preview input')
  expect(screen.queryByText('Preview complete')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Continue preview' }))
  await screen.findByText('Preview complete')
  expect(api.previewDraft).toHaveBeenNthCalledWith(1, 'flow', { question: 'Keep preview input' })
  expect(api.previewDraft).toHaveBeenNthCalledWith(2, 'flow', { question: 'Keep preview input' })
})

it('refuses a trace from another draft version and offers explicit reload', async () => {
  const reload = vi.fn()
  vi.mocked(api.previewDraft).mockResolvedValue({ ...trace, draftVersion: 2 })
  render(<DraftPreview draft={draft} onClose={vi.fn()} onReload={reload} />)
  fireEvent.change(screen.getByLabelText('How can we improve?'), { target: { value: 'Old version preview' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue preview' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Preview complete')).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Preview rule evaluations' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('How can we improve?')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Reload draft' }))
  expect(reload).toHaveBeenCalledTimes(1)
})

it('invalidates an inspected trace when test answers change and ignores a late acknowledgement after closing', async () => {
  const late = deferred<typeof trace>()
  vi.mocked(api.previewDraft).mockResolvedValueOnce(trace).mockReturnValue(late.promise)
  const view = render(<DraftPreview draft={draft} onClose={vi.fn()} onReload={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('How can we improve?'), { target: { value: 'First preview input' } })
  fireEvent.click(screen.getByRole('button', { name: 'Inspect answer path' }))
  await screen.findByRole('region', { name: 'Preview rule evaluations' })
  fireEvent.change(screen.getByLabelText('How can we improve?'), { target: { value: 'New preview input' } })
  expect(screen.queryByRole('region', { name: 'Preview rule evaluations' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Inspect answer path' }))
  view.unmount()
  await act(async () => late.resolve(trace))
  await waitFor(() => expect(api.previewDraft).toHaveBeenCalledTimes(2))
  expect(api.previewDraft).toHaveBeenLastCalledWith('flow', { question: 'New preview input' })
  expect(api.submitResponse).not.toHaveBeenCalled()
})
