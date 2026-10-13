// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { importsApi, type Job } from '../core/features/importing/ui/api'
import { ImportPage } from '../core/features/importing/ui/ImportPage'
import type { ImportReview } from '../core/features/importing/model'
import { contract } from './contract'
import { renderOperator } from './ui-fixtures'

vi.mock('../core/features/importing/ui/api', () => ({ importsApi: {
  review: vi.fn(), commit: vi.fn(), list: vi.fn(), resume: vi.fn(), undo: vi.fn(), cancelStaging: vi.fn(),
} }))
const definition = JSON.stringify({ title: 'Prepared form', fields: [{ ref: 'answer', title: 'Answer', type: 'short_text' }] })
const review: ImportReview = {
  plannedAt: '2026-09-12T10:03:00.000Z', fingerprint: 'reviewed-fingerprint', flowId: 'reviewed-flow', title: 'Prepared form',
  report: [], headers: [], forbiddenColumns: [], columns: [], questions: [], rowErrors: [], responseCount: 201,
  lossRequired: true, alreadyImported: false, heldByOtherOperator: false,
}
const prepared: Job = { id: 'prepared-import', state: 'preparing', checkpoint: 0, total: 202, error: null }
const completed: Job = { ...prepared, state: 'completed', checkpoint: 202 }
let dispose: (() => void) | undefined
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.mocked(importsApi.list).mockResolvedValue([])
  vi.mocked(importsApi.review).mockResolvedValue(review)
  vi.mocked(importsApi.commit).mockResolvedValue(prepared)
  vi.mocked(importsApi.resume).mockResolvedValue(completed)
})
afterEach(() => { dispose?.(); dispose = undefined; cleanup(); vi.restoreAllMocks() })
function show() { dispose = renderOperator(<ImportPage />, '/app').dispose }
async function acknowledge() {
  const input = await screen.findByLabelText('Form definition JSON')
  const file = new File([definition], 'form.json', { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: async () => definition })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review import' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Review import' }))
  await screen.findByRole('heading', { name: 'Review the mapping' })
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import reviewed form' })) })
}

contract(['IMPORT-002', 'IMPORT-004'], 'acknowledgement stays ready without resume, reload stays passive, and explicit continue follows every batch and undo', async () => {
  show()
  await acknowledge()
  expect(importsApi.commit).toHaveBeenCalledExactlyOnceWith({ definition, csv: '', source: 'typeform', columns: [], plannedAt: review.plannedAt }, review.fingerprint)
  expect(await screen.findByRole('heading', { name: 'Ready to verify · 0 / 202' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Continue import' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Pause after this batch' })).not.toBeInTheDocument()
  expect(importsApi.resume).toHaveBeenCalledTimes(0)
  vi.mocked(importsApi.list).mockResolvedValue([prepared])
  fireEvent.click(screen.getByRole('button', { name: 'Refresh history' }))
  await waitFor(() => expect(importsApi.list).toHaveBeenCalledTimes(2))
  dispose!(); dispose = undefined
  show()
  expect(await screen.findByRole('heading', { name: 'Ready to verify · 0 / 202' })).toBeVisible()
  expect(importsApi.resume).toHaveBeenCalledTimes(0)
  vi.mocked(importsApi.resume)
    .mockResolvedValueOnce({ ...prepared, state: 'applying', checkpoint: 100 })
    .mockResolvedValueOnce({ ...prepared, state: 'applying', checkpoint: 200 })
    .mockResolvedValueOnce(completed)
  fireEvent.click(screen.getByRole('button', { name: 'Continue import' }))
  expect(await screen.findByRole('heading', { name: 'completed · 202 / 202' })).toBeVisible()
  expect(vi.mocked(importsApi.resume).mock.calls).toEqual([[prepared.id], [prepared.id], [prepared.id]])
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(importsApi.undo).mockResolvedValue({ ...completed, state: 'undoing', checkpoint: 100 })
  vi.mocked(importsApi.resume).mockResolvedValue({ ...completed, state: 'undone' })
  fireEvent.click(screen.getByRole('button', { name: 'Undo import' }))
  expect(await screen.findByRole('heading', { name: 'undone · 202 / 202' })).toBeVisible()
  expect(importsApi.undo).toHaveBeenCalledExactlyOnceWith(prepared.id)
  expect(importsApi.resume).toHaveBeenCalledTimes(4)
})

for (const state of ['queued', 'applying', 'completed']) {
  contract(['IMPORT-004'], `acknowledgement replay retains automatic progress for a public ${state} job`, async () => {
    vi.mocked(importsApi.commit).mockResolvedValue({ ...prepared, state, checkpoint: state === 'completed' ? 202 : 0 })
    show()
    await acknowledge()
    expect(await screen.findByRole('heading', { name: 'completed · 202 / 202' })).toBeVisible()
    expect(importsApi.resume).toHaveBeenCalledTimes(state === 'completed' ? 0 : 1)
    if (state !== 'completed') expect(importsApi.resume).toHaveBeenCalledExactlyOnceWith(prepared.id)
    expect(screen.getByRole('button', { name: 'Undo import' })).toBeEnabled()
  })
}

contract(['IMPORT-004'], 'an interrupted preparation remains visible for retry or cancellation without automatic resume', async () => {
  vi.mocked(importsApi.commit).mockResolvedValue({ ...prepared, state: 'preparation-interrupted', error: 'Preparation was interrupted.' })
  show()
  await acknowledge()
  expect(await screen.findByRole('heading', { name: 'Preparation needs attention · 0 / 202' })).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent('Preparation was interrupted.')
  expect(screen.getByRole('button', { name: 'Cancel preparation' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Continue import' })).not.toBeInTheDocument()
  expect(importsApi.resume).toHaveBeenCalledTimes(0)
})
