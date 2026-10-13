// @vitest-environment jsdom
import { contract } from './contract'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, ApiError } from '../core/app/api'
import { RespondentFlowPage } from '../core/features/responses/ui/RespondentFlowPage'
import { PublicClosedPage } from '../core/features/responses/ui/PublicClosedPage'
import { config, draft } from './ui-fixtures'

vi.mock('../core/app/api', async (original) => {
  const actual = await original<typeof import('../core/app/api')>()
  return { ...actual, api: Object.fromEntries(Object.keys(actual.api).map((key) => [key, vi.fn()])) }
})
beforeEach(() => vi.resetAllMocks())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

contract(['RESP-005'], 'discloses privacy before interaction, shows it once on welcome, and keeps a working return path', async () => {
  const flow = { ...draft, steps: [{ ...draft.steps[1], id: 'welcome', position: 0, kind: 'welcome' as const, prompt: 'Before you begin', nextStepId: 'question' }, ...draft.steps.map((step) => ({ ...step, position: step.position + 1 }))] }
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow })
  vi.mocked(api.advanceSession).mockResolvedValue(undefined)
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  expect(screen.getByText('Before you share')).toBeInTheDocument()
  expect(screen.getByText(/operators can see the answers you submit/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  expect(api.startSession).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Begin' }))
  await screen.findByRole('heading', { name: 'How can we improve?' })
  expect(screen.queryByText('Before you share')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByText('Before you share')).toBeInTheDocument()
  expect(api.startSession).toHaveBeenCalledTimes(1)
  expect(api.submitResponse).not.toHaveBeenCalled()
})

contract(['RESP-005'], 'tells respondents their written answers may reach an AI service only while the deployment can analyse them', () => {
  for (const answersMayReachAi of [false, true]) {
    render(<RespondentFlowPage config={{ ...config, answersMayReachAi }} slug="review" initialFlow={draft} />)
    expect(screen.getByText('Before you share')).toBeInTheDocument()
    expect(document.querySelector('[data-disclosure="ai-analysis"]') !== null).toBe(answersMayReachAi)
    cleanup()
  }
})

contract(['RESP-005', 'RESP-014'], 'keeps the no-welcome disclosure, entered answers and the same receipt key after a failed final acknowledgement', async () => {
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse).mockRejectedValueOnce(new Error('Response acknowledgement lost')).mockResolvedValue({ responseId: 'response', idempotent: true, disposition: 'quarantined', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  expect(screen.getByText('Before you share')).toBeInTheDocument()
  expect(api.startSession).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Retain these exact synthetic words' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('textbox', { name: 'How can we improve?' })).toHaveValue('Retain these exact synthetic words')
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  expect(api.submitResponse).toHaveBeenCalledTimes(2)
  expect(vi.mocked(api.submitResponse).mock.calls[1]).toEqual(vi.mocked(api.submitResponse).mock.calls[0])
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Submit response' })).not.toBeInTheDocument())
})

it('holds the original final attempt after a lost acknowledgement and shows its committed completion', async () => {
  const flow = {
    ...draft,
    steps: [
      { ...draft.steps[0], questionType: 'single_choice' as const, prompt: 'Which completion?', nextStepId: 'completion-a' },
      { ...draft.steps[1], id: 'completion-a', position: 1, prompt: 'Recorded path A' },
      { ...draft.steps[1], id: 'completion-b', position: 2, prompt: 'Recorded path B' },
    ],
    choices: [{ id: 'choice-a', stepId: 'question', value: 'a', label: 'Path A', position: 0 }, { id: 'choice-b', stepId: 'question', value: 'b', label: 'Path B', position: 1 }],
    branchRules: [{ id: 'branch', sourceStepId: 'question', predicateKind: 'equals' as const, expectedValue: 'choice-b', destinationStepId: 'completion-b', position: 0 }],
  }
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow })
  vi.mocked(api.submitResponse).mockRejectedValueOnce(new Error('Committed response acknowledgement lost')).mockResolvedValue({ responseId: 'response', idempotent: true, disposition: 'released', completionStepId: 'completion-a' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Path A' }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('radio', { name: 'Path B' })).toBeDisabled()
  fireEvent.click(screen.getByRole('radio', { name: 'Path B' }))
  expect(screen.getByRole('radio', { name: 'Path A' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'Recorded path A' })
  expect(screen.queryByRole('heading', { name: 'Recorded path B' })).not.toBeInTheDocument()
  const attempts = vi.mocked(api.submitResponse).mock.calls
  expect(attempts[0][1].answers).toEqual([{ stepId: 'question', value: 'choice-a' }])
  expect(attempts[1][1].answers).toEqual([{ stepId: 'question', value: 'choice-a' }])
  expect(attempts[1][1].idempotencyKey).toBe(attempts[0][1].idempotencyKey)
  expect(api.submitResponse).toHaveBeenCalledTimes(2)
})

it('cannot be stranded on a longer branch after losing a committed final acknowledgement', async () => {
  const flow = {
    ...draft,
    steps: [
      { ...draft.steps[0], questionType: 'single_choice' as const, prompt: 'Which path?', nextStepId: 'completion-a' },
      { ...draft.steps[0], id: 'extra-question', position: 1, prompt: 'An extra question', nextStepId: 'completion-b' },
      { ...draft.steps[1], id: 'completion-a', position: 2, prompt: 'Recorded path A' },
      { ...draft.steps[1], id: 'completion-b', position: 3, prompt: 'Recorded path B' },
    ],
    choices: [{ id: 'choice-a', stepId: 'question', value: 'a', label: 'Finish now', position: 0 }, { id: 'choice-b', stepId: 'question', value: 'b', label: 'Longer path', position: 1 }],
    branchRules: [{ id: 'branch', sourceStepId: 'question', predicateKind: 'equals' as const, expectedValue: 'choice-b', destinationStepId: 'extra-question', position: 0 }],
  }
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow })
  vi.mocked(api.submitResponse).mockRejectedValueOnce(new Error('Committed acknowledgement lost')).mockResolvedValue({ responseId: 'response', idempotent: true, disposition: 'released', completionStepId: 'completion-a' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Finish now' }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('radio', { name: 'Longer path' })).toBeDisabled()
  fireEvent.click(screen.getByRole('radio', { name: 'Longer path' }))
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'Recorded path A' })
  expect(api.advanceSession).not.toHaveBeenCalled()
  expect(vi.mocked(api.submitResponse).mock.calls[1]).toEqual(vi.mocked(api.submitResponse).mock.calls[0])
})

contract(['RESP-003'], 'unlocks a definitively refused final request for correction without showing completion', async () => {
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse).mockRejectedValueOnce(new ApiError('VALIDATION_ERROR', 'The final answer was refused.', 400)).mockResolvedValue({ responseId: 'response', idempotent: false, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  const input = screen.getByRole('textbox', { name: 'How can we improve?' })
  fireEvent.change(input, { target: { value: 'First answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('alert')
  expect(input).toBeEnabled()
  expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument()
  fireEvent.change(input, { target: { value: 'Corrected answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  expect(vi.mocked(api.submitResponse).mock.calls[1][1].answers).toEqual([{ stepId: 'question', value: 'Corrected answer' }])
})

it('keeps the ordinary completion for an explicit audit-only honeypot drop', async () => {
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse).mockResolvedValue({ responseId: null, idempotent: false, disposition: 'dropped', completionStepId: null })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Synthetic answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})


it('keeps the original unknown final attempt after a rate-limited retry until its receipt is confirmed', async () => {
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse)
    .mockRejectedValueOnce(new Error('Original acknowledgement lost'))
    .mockRejectedValueOnce(new ApiError('RATE_LIMITED', 'Wait a minute before retrying.', 429))
    .mockResolvedValue({ responseId: 'response', idempotent: true, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  const input = screen.getByRole('textbox', { name: 'How can we improve?' })
  fireEvent.change(input, { target: { value: 'Original submitted answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Wait a minute'))
  expect(input).toBeDisabled()
  fireEvent.change(input, { target: { value: 'This newer edit must not enter the pending submission' } })
  expect(input).toHaveValue('Original submitted answer')
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  const attempts = vi.mocked(api.submitResponse).mock.calls
  expect(attempts).toHaveLength(3)
  expect(attempts[1]).toEqual(attempts[0])
  expect(attempts[2]).toEqual(attempts[0])
})

it('hides answers but retains an unknown final receipt through closure and later confirmation', async () => {
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse)
    .mockRejectedValueOnce(new Error('Original acknowledgement lost'))
    .mockRejectedValueOnce(new ApiError('FLOW_CLOSED', 'The flow has closed.', 409, undefined, { title: 'Visit review', slug: 'review' }))
    .mockResolvedValue({ responseId: 'response', idempotent: true, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Original hidden pending answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'This feedback flow is closed.' })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByText('Original hidden pending answer')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Pending submission' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  const attempts = vi.mocked(api.submitResponse).mock.calls
  expect(attempts).toHaveLength(3)
  expect(attempts[1]).toEqual(attempts[0])
  expect(attempts[2]).toEqual(attempts[0])
})

contract('RESP-014', 'keeps a first closed final private and retries the exact original payload through repeated refusal and acknowledgement loss', async () => {
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse)
    .mockRejectedValueOnce(new ApiError('FLOW_CLOSED', 'The flow has closed.', 409, undefined, { title: 'Visit review', slug: 'review' }))
    .mockRejectedValueOnce(new ApiError('FLOW_CLOSED', 'The flow is still closed.', 409, undefined, { title: 'Visit review', slug: 'review' }))
    .mockRejectedValueOnce(new Error('Reopened submission acknowledgement lost'))
    .mockRejectedValueOnce(new ApiError('SESSION_UNAVAILABLE', 'This session is unavailable.', 400))
    .mockRejectedValueOnce(new ApiError('RATE_LIMITED', 'Wait before retrying.', 429))
    .mockResolvedValue({ responseId: 'response', idempotent: true, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Refused answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('heading', { name: 'This feedback flow is closed.' })
  expect(screen.getByText('Visit review')).toBeInTheDocument()
  expect(screen.getByText(config.publicFlowBusinessName)).toBeInTheDocument()
  expect(api.submitResponse).toHaveBeenCalledTimes(1)
  for (const message of ['The flow is still closed.', 'Reopened submission acknowledgement lost', 'This session is unavailable.', 'Wait before retrying.']) {
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Refused answer')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start again' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  const attempts = vi.mocked(api.submitResponse).mock.calls
  expect(attempts).toHaveLength(6)
  expect(attempts[0][1].answers).toEqual([{ stepId: 'question', value: 'Refused answer' }])
  expect(attempts[0][1].idempotencyKey).toBeTruthy()
  for (const attempt of attempts.slice(1)) expect(attempt).toEqual(attempts[0])
  expect(api.startSession).toHaveBeenCalledTimes(1)
  expect(api.advanceSession).not.toHaveBeenCalled()
})

it('keeps a fresh closed-page visitor free of private recovery controls', () => {
  render(<PublicClosedPage config={config} flow={{ title: 'Closed visit', slug: 'review' }} />)
  expect(screen.getByRole('heading', { name: 'This feedback flow is closed.' })).toBeInTheDocument()
  expect(screen.getByText(config.publicFlowBusinessName)).toBeInTheDocument()
  expect(screen.getByText('Closed visit')).toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(api.startSession).not.toHaveBeenCalled(); expect(api.submitResponse).not.toHaveBeenCalled()
})

it('retains private answers through a closed restart and failed retry, then uses fresh same-revision admission and the original key', async () => {
  vi.mocked(api.startSession)
    .mockResolvedValueOnce({ sessionId: 'expired', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
    .mockRejectedValueOnce(new ApiError('FLOW_CLOSED', 'The form is closed.', 409, undefined, { title: 'Visit review', slug: 'review' }))
    .mockRejectedValueOnce(new Error('Current form could not load'))
    .mockResolvedValueOnce({ sessionId: 'fresh', sessionToken: 'b'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse)
    .mockRejectedValueOnce(new ApiError('SESSION_UNAVAILABLE', 'Session unavailable', 400))
    .mockResolvedValue({ responseId: 'response', idempotent: false, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Retain during closed restart' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Start again' }))
  await screen.findByRole('heading', { name: 'This feedback flow is closed.' })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByText('Retain during closed restart')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retry submission' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Response recovery' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Current form could not load'))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(api.submitResponse).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  const input = await screen.findByRole('textbox', { name: 'How can we improve?' })
  expect(input).toHaveValue('Retain during closed restart'); expect(input).toBeEnabled()
  expect(screen.queryByRole('heading', { name: 'This feedback flow is closed.' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  expect(vi.mocked(api.submitResponse).mock.calls[1][1]).toEqual({ ...vi.mocked(api.submitResponse).mock.calls[0][1], sessionId: 'fresh', sessionToken: 'b'.repeat(64) })
  expect(api.startSession).toHaveBeenCalledTimes(4)
})

it('keeps closed-restart answers hidden after changed-revision cancellation and adopts only the confirmed candidate', async () => {
  const changed = { ...draft, revision: { ...draft.revision, id: 'changed-revision' }, steps: draft.steps.map(step => step.kind === 'question' ? { ...step, prompt: 'A changed question' } : step) }
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  vi.mocked(api.startSession)
    .mockResolvedValueOnce({ sessionId: 'expired', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
    .mockRejectedValueOnce(new ApiError('FLOW_CLOSED', 'The form is closed.', 409, undefined, { title: 'Visit review', slug: 'review' }))
    .mockResolvedValueOnce({ sessionId: 'fresh', sessionToken: 'b'.repeat(64), revisionId: changed.revision.id, flowId: draft.flow.id, flow: changed })
  vi.mocked(api.submitResponse).mockRejectedValueOnce(new ApiError('SESSION_UNAVAILABLE', 'Session unavailable', 400))
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Retain until confirmed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Start again' }))
  await screen.findByRole('heading', { name: 'This feedback flow is closed.' })
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByText('Retain until confirmed')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'A changed question' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  const current = await screen.findByRole('textbox', { name: 'A changed question' })
  expect(current).toHaveValue(''); expect(current).toBeEnabled()
  expect(api.startSession).toHaveBeenCalledTimes(3)
  expect(api.submitResponse).toHaveBeenCalledTimes(1)
  expect(confirm).toHaveBeenNthCalledWith(1, 'The form has changed. Start a new response and clear your unsent answers?')
  expect(confirm).toHaveBeenCalledTimes(2)
})

it('restarts a definitively unavailable session with fresh credentials while retaining answers and the key', async () => {
  vi.mocked(api.startSession)
    .mockResolvedValueOnce({ sessionId: 'expired', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
    .mockResolvedValueOnce({ sessionId: 'fresh', sessionToken: 'b'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse)
    .mockRejectedValueOnce(new ApiError('SESSION_UNAVAILABLE', 'Start again using the current form.', 400))
    .mockResolvedValue({ responseId: 'response', idempotent: false, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" embedded initialFlow={draft} />)
  const input = screen.getByRole('textbox', { name: 'How can we improve?' })
  fireEvent.change(input, { target: { value: 'Preserve the unsent answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('button', { name: 'Start again' })
  expect(input).toHaveValue('Preserve the unsent answer'); expect(input).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  await waitFor(() => expect(input).toBeEnabled())
  expect(input).toHaveValue('Preserve the unsent answer')
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  const attempts = vi.mocked(api.submitResponse).mock.calls
  expect(attempts[1][1]).toEqual({ ...attempts[0][1], sessionId: 'fresh', sessionToken: 'b'.repeat(64) })
  expect(api.startSession).toHaveBeenNthCalledWith(2, 'review', 'tablet', 'embed')
})

it('preserves answers through failed restart and declined changed-revision consent, then adopts only the confirmed graph', async () => {
  const changed = { ...draft, revision: { ...draft.revision, id: 'changed-revision' }, steps: draft.steps.map(step => step.kind === 'question' ? { ...step, prompt: 'A changed question' } : step) }
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  vi.mocked(api.startSession)
    .mockResolvedValueOnce({ sessionId: 'expired', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
    .mockRejectedValueOnce(new Error('Current form could not load'))
    .mockResolvedValueOnce({ sessionId: 'fresh', sessionToken: 'b'.repeat(64), revisionId: changed.revision.id, flowId: draft.flow.id, flow: changed })
  vi.mocked(api.submitResponse).mockRejectedValueOnce(new ApiError('SESSION_UNAVAILABLE', 'Session unavailable', 400))
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  const input = screen.getByRole('textbox', { name: 'How can we improve?' })
  fireEvent.change(input, { target: { value: 'Retain until confirmed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('button', { name: 'Start again' })
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Current form could not load'))
  expect(input).toHaveValue('Retain until confirmed'); expect(input).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
  expect(input).toHaveValue('Retain until confirmed')
  expect(screen.queryByRole('heading', { name: 'A changed question' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  const current = await screen.findByRole('textbox', { name: 'A changed question' })
  expect(current).toHaveValue(''); expect(current).toBeEnabled()
  expect(api.startSession).toHaveBeenCalledTimes(3)
  expect(api.submitResponse).toHaveBeenCalledTimes(1)
  expect(confirm).toHaveBeenCalledTimes(2)
})

it('offers restart after an expired advance and resets progress only after fresh admission', async () => {
  const flow = { ...draft, steps: [{ ...draft.steps[1], id: 'welcome', position: 0, kind: 'welcome' as const, prompt: 'Before you begin', nextStepId: 'question' }, ...draft.steps.map(step => ({ ...step, position: step.position + 1 }))] }
  vi.mocked(api.startSession)
    .mockResolvedValueOnce({ sessionId: 'expired', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow })
    .mockResolvedValueOnce({ sessionId: 'fresh', sessionToken: 'b'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow })
  vi.mocked(api.advanceSession).mockRejectedValueOnce(new ApiError('SESSION_UNAVAILABLE', 'Session unavailable', 400)).mockResolvedValue(undefined)
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  fireEvent.click(screen.getByRole('button', { name: 'Begin' }))
  await screen.findByRole('button', { name: 'Start again' })
  expect(screen.getByRole('heading', { name: 'Before you begin' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  await screen.findByRole('button', { name: 'Begin' })
  fireEvent.click(screen.getByRole('button', { name: 'Begin' }))
  await screen.findByRole('heading', { name: 'How can we improve?' })
  expect(vi.mocked(api.advanceSession).mock.calls[1][1]).toMatchObject({ sessionId: 'fresh', sessionToken: 'b'.repeat(64), stepId: 'question' })
})

it('retains the exact unknown final through an unavailable retry without admitting a replacement session', async () => {
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'original', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse)
    .mockRejectedValueOnce(new Error('Acknowledgement lost'))
    .mockRejectedValueOnce(new ApiError('SESSION_UNAVAILABLE', 'Session unavailable', 400))
    .mockResolvedValue({ responseId: 'response', idempotent: true, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  const input = screen.getByRole('textbox', { name: 'How can we improve?' })
  fireEvent.change(input, { target: { value: 'Original pending answer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('button', { name: 'Retry submission' })
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Session unavailable'))
  expect(screen.queryByRole('button', { name: 'Start again' })).not.toBeInTheDocument()
  expect(input).toBeDisabled(); expect(input).toHaveValue('Original pending answer')
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  const attempts = vi.mocked(api.submitResponse).mock.calls
  expect(attempts).toHaveLength(3); expect(attempts[1]).toEqual(attempts[0]); expect(attempts[2]).toEqual(attempts[0])
  expect(api.startSession).toHaveBeenCalledTimes(1)
})

it('ignores a changed-revision restart acknowledgement after unmount without prompting the destination page', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof api.startSession>>) => void
  const pending = new Promise<Awaited<ReturnType<typeof api.startSession>>>(done => { resolve = done })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(api.startSession)
    .mockResolvedValueOnce({ sessionId: 'expired', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
    .mockReturnValueOnce(pending)
  vi.mocked(api.submitResponse).mockRejectedValueOnce(new ApiError('SESSION_UNAVAILABLE', 'Session unavailable', 400))
  const view = render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Keep on this page' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('button', { name: 'Start again' })
  fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
  await screen.findByRole('button', { name: 'Starting again…' })
  view.unmount()
  const changed = { ...draft, revision: { ...draft.revision, id: 'late-revision' } }
  resolve({ sessionId: 'late-session', sessionToken: 'b'.repeat(64), revisionId: changed.revision.id, flowId: draft.flow.id, flow: changed })
  await pending; await Promise.resolve()
  expect(confirm).not.toHaveBeenCalled()
  expect(api.submitResponse).toHaveBeenCalledTimes(1)
})

it('retains the just-entered answer when initial admission finds a new revision and adopts only after confirmation', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof api.startSession>>) => void
  const admission = new Promise<Awaited<ReturnType<typeof api.startSession>>>(done => { resolve = done })
  const changed = { ...draft, revision: { ...draft.revision, id: 'new-publication' }, steps: draft.steps.map(step => ({ ...step, prompt: step.kind === 'question' ? 'New published question' : 'New published completion' })) }
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  vi.mocked(api.startSession).mockReturnValue(admission)
  vi.mocked(api.submitResponse).mockResolvedValue({ responseId: 'response', idempotent: false, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  const oldInput = screen.getByRole('textbox', { name: 'How can we improve?' })
  fireEvent.change(oldInput, { target: { value: 'The answer entered before admission' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  resolve({ sessionId: 'new-session', sessionToken: 'b'.repeat(64), revisionId: changed.revision.id, flowId: draft.flow.id, flow: changed })
  await screen.findByRole('button', { name: 'Use current form' })
  expect(oldInput).toHaveValue('The answer entered before admission'); expect(oldInput).toBeDisabled()
  expect(api.submitResponse).not.toHaveBeenCalled(); expect(api.advanceSession).not.toHaveBeenCalled()
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Use current form' }))
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
  expect(oldInput).toHaveValue('The answer entered before admission')
  expect(screen.queryByRole('textbox', { name: 'New published question' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Use current form' }))
  const newInput = await screen.findByRole('textbox', { name: 'New published question' })
  expect(newInput).toHaveValue(''); expect(api.startSession).toHaveBeenCalledTimes(1)
  fireEvent.change(newInput, { target: { value: 'Answer for the confirmed graph' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('heading', { name: 'New published completion' })
  expect(vi.mocked(api.submitResponse).mock.calls[0][1]).toMatchObject({ sessionId: 'new-session', sessionToken: 'b'.repeat(64), revisionId: changed.revision.id, answers: [{ stepId: 'question', value: 'Answer for the confirmed graph' }] })
  expect(api.submitResponse).toHaveBeenCalledTimes(1); expect(api.startSession).toHaveBeenCalledTimes(1)
})

it('uses the admitted current graph without a discard prompt when no answer has been entered', async () => {
  const welcome = { ...draft.steps[1], id: 'welcome', position: 0, kind: 'welcome' as const, prompt: 'Before you begin', nextStepId: 'question' }
  const flow = { ...draft, steps: [welcome, ...draft.steps.map(step => ({ ...step, position: step.position + 1 }))] }
  const changed = { ...flow, revision: { ...flow.revision, id: 'new-publication' }, steps: flow.steps.map(step => step.kind === 'welcome' ? { ...step, prompt: 'Current welcome' } : step) }
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'new-session', sessionToken: 'b'.repeat(64), revisionId: changed.revision.id, flowId: draft.flow.id, flow: changed })
  vi.mocked(api.advanceSession).mockResolvedValue(undefined)
  render(<RespondentFlowPage config={config} slug="review" initialFlow={flow} />)
  fireEvent.click(screen.getByRole('button', { name: 'Begin' }))
  await screen.findByRole('button', { name: 'Use current form' })
  fireEvent.click(screen.getByRole('button', { name: 'Use current form' }))
  await screen.findByRole('heading', { name: 'Current welcome' })
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Begin' }))
  await screen.findByRole('heading', { name: 'How can we improve?' })
  expect(api.startSession).toHaveBeenCalledTimes(1)
  expect(vi.mocked(api.advanceSession).mock.calls[0][1]).toMatchObject({ sessionId: 'new-session', sessionToken: 'b'.repeat(64), revisionId: changed.revision.id })
})

it('does not post an advance or final after initial admission resolves on a page that has unmounted', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof api.startSession>>) => void
  const admission = new Promise<Awaited<ReturnType<typeof api.startSession>>>(done => { resolve = done })
  vi.mocked(api.startSession).mockReturnValue(admission)
  const view = render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Unsent after navigation' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  view.unmount()
  resolve({ sessionId: 'late-session', sessionToken: 'b'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  await admission; await Promise.resolve(); await Promise.resolve()
  expect(api.submitResponse).not.toHaveBeenCalled(); expect(api.advanceSession).not.toHaveBeenCalled()
})

contract('RESP-014', 'keeps answers off completion after an uncommitted 500 and retries the exact original final request', async () => {
  vi.mocked(api.startSession).mockResolvedValue({ sessionId: 'session', sessionToken: 'a'.repeat(64), revisionId: draft.revision.id, flowId: draft.flow.id, flow: draft })
  vi.mocked(api.submitResponse).mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 'The request could not be completed. Retry or inspect deployment health.', 500)).mockResolvedValue({ responseId: 'response', idempotent: false, disposition: 'released', completionStepId: 'completion' })
  render(<RespondentFlowPage config={config} slug="review" initialFlow={draft} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'How can we improve?' }), { target: { value: 'Exact uncommitted words' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'How can we improve?' })).toHaveValue('Exact uncommitted words')
  expect(screen.getByRole('textbox', { name: 'How can we improve?' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Retry submission' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
  await screen.findByRole('heading', { name: 'Thank you' })
  expect(vi.mocked(api.submitResponse).mock.calls[1]).toEqual(vi.mocked(api.submitResponse).mock.calls[0])
  expect(vi.mocked(api.submitResponse).mock.calls[0][1].idempotencyKey).toBeTruthy()
  expect(api.startSession).toHaveBeenCalledTimes(1)
  expect(api.advanceSession).not.toHaveBeenCalled()
})
