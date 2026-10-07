// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../core/app/api'
import { FlowBuilderPage } from '../core/features/flows/ui/FlowBuilderPage'
import { FlowSharePanel, flowShareLinks } from '../core/features/flows/ui/FlowSharePanel'
import { draft, flow, renderOperator, workspace } from './ui-fixtures'

vi.mock('../core/app/api', async original => {
  const actual = await original<typeof import('../core/app/api')>()
  return { ...actual, api: Object.fromEntries(Object.keys(actual.api).map(key => [key, vi.fn()])) }
})
let dispose: (() => void) | undefined
const clipboard = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: clipboard } })
  clipboard.mockResolvedValue(undefined)
  vi.mocked(api.builder).mockResolvedValue(draft)
  vi.mocked(api.workspace).mockResolvedValue(workspace)
})
afterEach(() => { dispose?.(); dispose = undefined; cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function show(element: React.ReactNode) { dispose = renderOperator(element, '/app/flows/flow/builder').dispose }

it('uses the deployment origin and canonical routes rather than the current app path or an example host', () => {
  expect(flowShareLinks('https://feedback.example:8443/app/flows/id/builder?revision=2', 'café visits')).toEqual({
    publicUrl: 'https://feedback.example:8443/f/caf%C3%A9%20visits',
    embedCode: '<iframe src="https://feedback.example:8443/embed/caf%C3%A9%20visits" title="Feedback form" width="100%" height="700" style="border:0"></iframe>',
  })
})

it('reveals the published link and iframe without saving or publishing the draft, and copies each exact value', async () => {
  show(<FlowBuilderPage />)
  const share = await screen.findByRole('button', { name: 'Share' })
  expect(share).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(share)
  expect(share).toHaveAttribute('aria-expanded', 'true')
  const links = flowShareLinks(window.location.origin, flow.slug)
  expect(await screen.findByRole('textbox', { name: 'Public link' })).toHaveValue(links.publicUrl)
  expect(screen.getByRole('textbox', { name: 'Embed code' })).toHaveValue(links.embedCode)
  fireEvent.click(screen.getByRole('button', { name: 'Copy public link' }))
  await screen.findByText('Public link copied.')
  fireEvent.click(screen.getByRole('button', { name: 'Copy embed code' }))
  await screen.findByText('Embed code copied.')
  expect(clipboard.mock.calls).toEqual([[links.publicUrl], [links.embedCode]])
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/app/settings')
  expect(api.publishDraft).not.toHaveBeenCalled(); expect(api.saveDraft).not.toHaveBeenCalled()
  fireEvent.click(share)
  expect(screen.queryByRole('region', { name: 'Share this flow' })).not.toBeInTheDocument()
})

it.each(['draft', 'archived'] as const)('explains %s visibility without providing a public URL or copy action', async status => {
  show(<FlowSharePanel flow={{ ...draft.flow, status }} />)
  await screen.findByRole('heading', { name: 'Share this flow' })
  expect(screen.getByText(status === 'draft' ? /Publish this flow before sharing/ : /This flow is archived/)).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(api.publishDraft).not.toHaveBeenCalled()
})

it('keeps a closed published link available with its closed-state explanation', async () => {
  show(<FlowSharePanel flow={{ ...draft.flow, status: 'closed' }} />)
  expect(await screen.findByRole('textbox', { name: 'Public link' })).toHaveValue(`${window.location.origin}/f/review`)
  expect(screen.getByText(/Visitors will see the closed page/)).toBeInTheDocument()
  expect(api.publishDraft).not.toHaveBeenCalled()
})

it.each(['denied', 'unavailable'] as const)('offers selected manual-copy text when the clipboard is %s, and never claims success', async reason => {
  if (reason === 'denied') clipboard.mockRejectedValue(new Error('Clipboard denied'))
  else vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
  show(<FlowSharePanel flow={draft.flow} />)
  const input = await screen.findByRole('textbox', { name: 'Public link' }) as HTMLInputElement
  fireEvent.click(screen.getByRole('button', { name: 'Copy public link' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Public link copied.')).not.toBeInTheDocument()
  expect(input).toHaveFocus(); expect(input.selectionStart).toBe(0); expect(input.selectionEnd).toBe(input.value.length)
  expect(input).toHaveAttribute('readonly')
})

it('keeps labelled copy and manual-selection controls at mobile width and waits for clipboard acknowledgement', async () => {
  vi.stubGlobal('innerWidth', 390)
  let resolve!: () => void
  clipboard.mockImplementation(() => new Promise<void>(ack => { resolve = ack }))
  show(<FlowSharePanel flow={draft.flow} />)
  const textarea = await screen.findByRole('textbox', { name: 'Embed code' }) as HTMLTextAreaElement
  fireEvent.click(screen.getByRole('button', { name: 'Copy embed code' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copying…' })).toBeDisabled())
  expect(screen.queryByText('Embed code copied.')).not.toBeInTheDocument()
  await act(async () => resolve())
  expect(await screen.findByText('Embed code copied.')).toBeInTheDocument()
  fireEvent.focus(textarea)
  expect(textarea.selectionEnd).toBe(textarea.value.length)
  expect(screen.getByRole('button', { name: 'Copy embed code' })).toBeEnabled()
})
