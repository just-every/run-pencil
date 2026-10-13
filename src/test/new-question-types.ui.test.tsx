// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { QuestionInput } from '../core/shared/ui/QuestionInput'
import { RespondentFlowPage } from '../core/features/responses/ui/RespondentFlowPage'
import { api } from '../core/app/api'
import { config, draft } from './ui-fixtures'
vi.mock('../core/app/api', async original => ({ ...await original<typeof import('../core/app/api')>(), api: { startSession: vi.fn(), advanceSession: vi.fn(), submitResponse: vi.fn() } }))
afterEach(cleanup); beforeEach(() => vi.resetAllMocks())
contract(['FLOW-003', 'RESP-003'], 'keeps new controls empty and retains false, zero, decimals and calendar values', () => {
  for (const type of ['dropdown', 'yes_no', 'nps', 'number', 'date', 'consent'] as const) {
    const changed = vi.fn(), step = { ...draft.steps[0], questionType: type, required: true, questionSettings: { statement: 'Agree' } }
    const view = render(<QuestionInput step={step} choices={[{ id: 'a', label: 'Alpha', value: 'a', stepId: step.id, position: 0 }]} value={undefined} onChange={changed} />)
    expect(view.container.querySelectorAll('input:checked')).toHaveLength(0)
    if (type === 'consent') expect(screen.getByRole('checkbox')).toHaveAccessibleDescription('Agree')
    if (type === 'nps') expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription(/Not at all likely.*Extremely likely/)
    if (type === 'yes_no') { fireEvent.click(screen.getByRole('radio', { name: 'No' })); expect(changed).toHaveBeenCalledWith(false) }
    if (type === 'nps') { fireEvent.click(screen.getByRole('radio', { name: '0' })); expect(changed).toHaveBeenCalledWith(0) }
    if (type === 'number') { fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '-1.25' } }); expect(changed).toHaveBeenCalledWith(-1.25) }
    if (type === 'date') { fireEvent.input(screen.getByLabelText(step.prompt), { target: { value: '2024-02-29' } }); expect(changed).toHaveBeenCalledWith('2024-02-29') }
    view.unmount()
  }
})
contract(['RESP-002', 'RESP-003', 'RESP-004'], 'counts deliberate optional skips and zero answers without fabricating stored answers', async () => {
  const flow = { ...draft, steps: [{ ...draft.steps[0], required: false, nextStepId: 'zero' }, { ...draft.steps[0], id: 'zero', position: 1, questionType: 'number' as const, prompt: 'Zero allowed', required: true, nextStepId: 'completion' }, { ...draft.steps[1], position: 2 }] }
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 's', sessionToken: 'a'.repeat(64), revisionId: flow.revision.id, flowId: flow.flow.id, flow })
  vi.mocked(api.advanceSession).mockResolvedValue(undefined)
  vi.mocked(api.submitResponse).mockResolvedValue({ responseId: 'r', idempotent: false, completionStepId: 'completion', disposition: 'released' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { name: 'Zero allowed' })
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  expect(screen.getByText('1 remaining')).toBeVisible()
  fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '0' } })
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  expect(screen.getByText('0 remaining')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByText('Thank you. This public link cannot edit a completed response.')
  expect(vi.mocked(api.submitResponse).mock.calls[0][1].answers).toEqual([{ stepId: 'zero', value: 0 }])
})
contract('FLOW-003', 'searches a long dropdown without changing stable choice IDs', () => {
  const changed = vi.fn(), choices = Array.from({ length: 100 }, (_, i) => ({ id: `stable-${i}`, label: `Option ${i}`, value: `value-${i}`, stepId: 'question', position: i }))
  render(<QuestionInput step={{ ...draft.steps[0], questionType: 'dropdown' }} choices={choices} value={undefined} onChange={changed} />)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Option 99' } })
  expect(screen.getAllByRole('option')).toHaveLength(2)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'stable-99' } })
  expect(changed).toHaveBeenCalledWith('stable-99')
})
contract('RESP-003', 'clears native numeric editing state when the respondent adopts a newer revision', async () => {
  const initial = { ...draft, steps: [{ ...draft.steps[0], questionType: 'number' as const }, draft.steps[1]] }
  const changed = { ...initial, revision: { ...initial.revision, id: 'new-revision' } }
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 's', sessionToken: 'a'.repeat(64), revisionId: changed.revision.id, flowId: changed.flow.id, flow: changed })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<RespondentFlowPage config={config} slug="review" initialFlow={initial} />)
  fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '-1.25' } })
  await screen.findByRole('button', { name: 'Use current form' })
  expect(screen.getByRole('spinbutton')).toHaveValue(-1.25)
  fireEvent.click(screen.getByRole('button', { name: 'Use current form' }))
  await screen.findByRole('button', { name: 'Submit response' })
  expect(screen.getByRole('spinbutton')).toHaveValue(null)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  expect(api.submitResponse).not.toHaveBeenCalled()
  confirm.mockRestore()
})

contract('RESP-013', 'starts a session on native input before a numeric prefix becomes a complete answer', async () => {
  const flow = { ...draft, steps: [{ ...draft.steps[0], questionType: 'number' as const }, draft.steps[1]] }
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 's', sessionToken: 'a'.repeat(64), revisionId: flow.revision.id, flowId: flow.flow.id, flow })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  expect(api.startSession).not.toHaveBeenCalled()
  fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '' } })
  expect(api.startSession).toHaveBeenCalledOnce()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  expect(api.submitResponse).not.toHaveBeenCalled()
})

contract('RESP-013', 'searching options starts a session without answering or advancing progress', async () => {
  const flow = { ...draft, steps: [{ ...draft.steps[0], questionType: 'dropdown' as const }, draft.steps[1]], choices: [{ id: 'stable', stepId: 'question', label: 'Find me', value: 'find', position: 0 }] }
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 's', sessionToken: 'a'.repeat(64), revisionId: flow.revision.id, flowId: flow.flow.id, flow })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Find' } })
  expect(api.startSession).toHaveBeenCalledOnce()
  expect(screen.getByRole('combobox')).toHaveValue('')
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  expect(api.submitResponse).not.toHaveBeenCalled()
})
