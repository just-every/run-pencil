// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { api, type BuilderDraft } from '../core/app/api'
import { FlowBuilderPage } from '../core/features/flows/ui/FlowBuilderPage'
import { contract } from './contract'
import { draft, renderOperator, workspace } from './ui-fixtures'

vi.mock('../core/app/api', async original => {
  const actual = await original<typeof import('../core/app/api')>()
  return { ...actual, api: Object.fromEntries(Object.keys(actual.api).map(key => [key, vi.fn()])) }
})
let dispose: (() => void) | undefined
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.workspace).mockResolvedValue(workspace)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(window, 'confirm').mockReturnValue(false)
})
afterEach(() => { dispose?.(); dispose = undefined; cleanup(); vi.restoreAllMocks() })
async function show(next: BuilderDraft) {
  vi.mocked(api.builder).mockResolvedValue(next)
  const view = renderOperator(<FlowBuilderPage />, '/app/flows/flow/builder')
  dispose = view.dispose
  await screen.findByLabelText('Question type')
  return within(screen.getByLabelText('Draft question canvas'))
}

contract(['FLOW-004', 'FLOW-005', 'RESP-003', 'BASE-PUBLIC-003'], 'changing multiple choice to priority clears canvas answers while retaining editable choices and one versioned Save', async () => {
  const initial: BuilderDraft = {
    ...draft,
    steps: draft.steps.map(step => step.id === 'question' ? { ...step, questionType: 'multiple_choice' } : step),
    choices: ['a', 'b', 'c'].map((id, position) => ({ id, stepId: 'question', label: id.toUpperCase(), value: id, position })),
    branchRules: [{ id: 'rule', sourceStepId: 'question', predicateKind: 'any_of', expectedValue: ['a'], destinationStepId: 'completion', position: 0 }],
  }
  const accepted: BuilderDraft = { ...initial, flow: { ...initial.flow, draftVersion: 2 }, steps: initial.steps.map(step => step.id === 'question' ? { ...step, questionType: 'priority' } : step), branchRules: [] }
  const canvas = await show(initial)
  vi.mocked(api.builder).mockResolvedValue(accepted)
  vi.mocked(api.saveDraft).mockResolvedValue({ kind: 'updated', draftVersion: 2, step: accepted.steps[0] })
  fireEvent.click(canvas.getByRole('option', { name: 'A' }))
  fireEvent.click(canvas.getByRole('option', { name: 'B' }))
  expect(canvas.getAllByRole('option', { selected: true })).toHaveLength(2)
  fireEvent.change(screen.getByLabelText('Question type'), { target: { value: 'priority' } })
  expect(canvas.getAllByRole('checkbox', { checked: false })).toHaveLength(3)
  expect(canvas.queryAllByRole('checkbox', { checked: true })).toHaveLength(0)
  for (const [index, label] of ['A', 'B', 'C'].entries()) expect(screen.getByLabelText(`Choice ${index + 1} label`)).toHaveValue(label)
  expect(screen.queryByLabelText('Match')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Preview draft' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
  expect(screen.getAllByRole('button', { name: /^Save$/ })).toHaveLength(1)
  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
  expect(api.saveDraft).not.toHaveBeenCalled()
  expect(api.startSession).not.toHaveBeenCalled()
  expect(api.submitResponse).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
  await screen.findByText('Saved.')
  expect(api.saveDraft).toHaveBeenCalledExactlyOnceWith('flow', expect.objectContaining({ expectedVersion: 1, questionType: 'priority', choices: initial.choices.map(({ id, value, label }) => ({ id, value, label })), rules: [] }))
  expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument()
  expect(canvas.queryAllByRole('checkbox', { checked: true })).toHaveLength(0)
})

contract(['FLOW-005', 'RESP-003', 'BASE-PUBLIC-003'], 'changing away from a selected rating and back starts a fresh canvas answer', async () => {
  const canvas = await show({ ...draft, steps: draft.steps.map(step => step.id === 'question' ? { ...step, questionType: 'rating', questionSettings: { min: 1, max: 5 } } : step) })
  fireEvent.click(canvas.getByRole('radio', { name: '4 out of 5' }))
  expect(canvas.getByRole('radio', { name: '4 out of 5' })).toHaveAttribute('data-selected', 'true')
  fireEvent.change(screen.getByLabelText('Question type'), { target: { value: 'short_text' } })
  expect(canvas.getByRole('textbox')).toHaveValue('')
  fireEvent.change(screen.getByLabelText('Question type'), { target: { value: 'rating' } })
  for (const button of canvas.getAllByRole('radio')) expect(button).toHaveAttribute('data-selected', 'false')
  expect(api.saveDraft).not.toHaveBeenCalled()
  expect(api.submitResponse).not.toHaveBeenCalled()
})

async function checkExplicitRatingAnswer(min: number, max: number) {
    const canvas = await show({ ...draft, steps: draft.steps.map(step => step.id === 'question' ? { ...step, questionType: 'rating', questionSettings: { min, max } } : step) })
    expect(canvas.getByRole('radiogroup')).toHaveAccessibleName(`${draft.steps[0].prompt} rating`)
    expect(canvas.getAllByRole('radio', { checked: false })).toHaveLength(max - min + 1)
    const selected = canvas.getByRole('radio', { name: `${min} out of ${max}` })
    fireEvent.click(selected)
    expect(selected).toHaveAttribute('aria-checked', 'true')
    expect(canvas.getAllByRole('radio', { checked: true })).toEqual([selected])
    fireEvent.click(canvas.getByRole('radio', { name: `${max} out of ${max}` }))
    expect(selected).toHaveAttribute('aria-checked', 'false')
    expect(canvas.getAllByRole('radio', { checked: true })).toEqual([canvas.getByRole('radio', { name: `${max} out of ${max}` })])
    expect(api.saveDraft).not.toHaveBeenCalled()
    expect(api.submitResponse).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview draft' })).toBeEnabled())
  }

contract(['RESP-003', 'BASE-PUBLIC-003'], 'the 0–10 rating exposes its selected state and updates only after an explicit answer', () => checkExplicitRatingAnswer(0, 10))
contract(['RESP-003', 'BASE-PUBLIC-003'], 'the 1–5 rating exposes its selected state and updates only after an explicit answer', () => checkExplicitRatingAnswer(1, 5))
