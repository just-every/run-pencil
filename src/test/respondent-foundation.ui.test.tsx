// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { QuestionInput } from '../core/shared/ui/QuestionInput'
import { RespondentFlowPage } from '../core/features/responses/ui/RespondentFlowPage'
import { api, type PublicFlow } from '../core/app/api'
import { config, draft } from './ui-fixtures'
vi.mock('../core/app/api', async original => {
  const actual = await original<typeof import('../core/app/api')>()
  return { ...actual, api: { ...actual.api, startSession: vi.fn(), advanceSession: vi.fn(), submitResponse: vi.fn() } }
})
afterEach(() => { cleanup(); vi.resetAllMocks() })
contract(['RESP-003'], 'every structured input begins unselected and records only an affirmative selection', () => {
  for (const questionType of ['rating', 'single_choice', 'multiple_choice', 'priority'] as const) {
    const changed = vi.fn()
    const step = { ...draft.steps[0], questionType, questionSettings: questionType === 'rating' ? { min: 1, max: 5 } : null }
    const choices = ['a', 'b'].map((id, position) => ({ id, stepId: step.id, position, value: id, label: id }))
    const view = render(<QuestionInput step={step} choices={choices} value={undefined} onChange={changed} />)
    expect(changed).not.toHaveBeenCalled()
    expect(view.container.querySelectorAll('[data-selected=true],[aria-checked=true],[aria-pressed=true]')).toHaveLength(0)
    fireEvent.click(view.container.querySelector('button')!)
    expect(changed).toHaveBeenCalledExactlyOnceWith(questionType === 'rating' ? 1 : questionType === 'single_choice' ? 'a' : ['a'])
    view.unmount()
  }
})
contract(['RESP-002', 'RESP-003', 'RESP-004'], 'branch changes recompute visible position and remaining questions; invalid input stays on screen without final submission', async () => {
  const flow: PublicFlow = { ...draft, steps: [
    { ...draft.steps[0], questionType: 'single_choice', prompt: 'Choose path', nextStepId: 'detail' },
    { ...draft.steps[0], id: 'detail', position: 1, prompt: 'Private details', nextStepId: 'completion' },
    { ...draft.steps[1], position: 2 },
  ], choices: ['short', 'long'].map((id, position) => ({ id, stepId: 'question', value: id, label: id, position })), branchRules: [{ id: 'rule', sourceStepId: 'question', destinationStepId: 'completion', predicateKind: 'equals', expectedValue: 'short', position: 0 }] }
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 's', sessionToken: 's'.repeat(64), revisionId: flow.revision.id, flowId: flow.flow.id, flow })
  vi.mocked(api.advanceSession).mockResolvedValue(undefined)
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  expect(screen.getByText('Question 1 of 2')).toBeVisible()
  expect(screen.getByText('2 remaining')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose path')
  expect(api.submitResponse).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', { name: 'short' }))
  expect(screen.getByText('Question 1 of 1')).toBeVisible()
  expect(screen.getByText('0 remaining')).toBeVisible()
  fireEvent.click(screen.getByRole('radio', { name: 'long' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(await screen.findByText('Question 2 of 2')).toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: 'Private details' }), { target: { value: 'Private unsent answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  fireEvent.click(screen.getByRole('radio', { name: 'short' }))
  expect(screen.getByText('Question 1 of 1')).toBeVisible()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(api.submitResponse).not.toHaveBeenCalled()
})
