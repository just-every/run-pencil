// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { ResponseLedger } from '../core/features/results/ui/ResponseLedger'
import { reportingApi, api, type Ledger, type LedgerResponse } from '../core/app/api'
vi.mock('../core/app/api', async original => { const actual = await original<typeof import('../core/app/api')>(); return { ...actual, api: { ...actual.api, eraseReleasedResponse: vi.fn() }, reportingApi: { ...actual.reportingApi, ledger: vi.fn() } } })
const response: LedgerResponse = { id: 'private-response', revisionId: 'private-revision', revisionNumber: 1, source: 'direct', startedAt: '2024-02-01T23:00:00Z', completedAt: '2024-02-01T23:05:00Z', releasedAt: '2024-02-01T23:05:00Z', participant: { id: 'participant', name: 'Alex', email: null }, answers: [{ stepId: 'first', label: 'Repeated prompt', position: 0, questionType: 'short_text', value: '', displayValue: '' }, { stepId: 'third', label: 'Repeated prompt', position: 2, questionType: 'number', value: 0, displayValue: '0' }], omittedQuestions: [{ stepId: 'second', label: 'Repeated prompt', position: 1 }] }
const ledger: Ledger = { flow: { id: 'flow', title: 'Study', slug: 'study' }, cutoff: '2024-02-02T00:00:00Z', filter: {}, revisions: [], total: 1, responses: [response] }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(reportingApi.ledger).mockResolvedValue(ledger) })
afterEach(cleanup)
contract(['LEDG-001', 'LEDG-002', 'DATA-002', 'WS-001'], 'keeps every answer identity and order while empty and skipped rows are explicit and erasure requires a separate confirmation', async () => {
  render(<ResponseLedger flowId="flow" revisionId="revision" timeZone="Australia/Brisbane" questions={[]} onChanged={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'View answers' }))
  expect(screen.getByText(/Invited participant: Alex/)).toBeInTheDocument()
  expect([...document.querySelectorAll('.ledger-answer dt')].map(element => element.textContent)).toEqual(['1. Repeated prompt', '2. Repeated prompt', '3. Repeated prompt'])
  expect(screen.getByText('Empty answer')).toBeInTheDocument()
  expect(screen.getByText('Not answered · skipped or optional')).toBeInTheDocument()
  expect(screen.getByText('0', { exact: true })).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/private-response|private-revision|first|second|third/)
  fireEvent.click(screen.getByRole('button', { name: 'Erase response' }))
  expect(screen.getByRole('alert')).toHaveTextContent('all its answers and pending effects')
  expect(api.eraseReleasedResponse).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Keep response' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Erase response' }))
  vi.mocked(api.eraseReleasedResponse).mockResolvedValue(undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Confirm erasure' }))
  await waitFor(() => expect(api.eraseReleasedResponse).toHaveBeenCalledExactlyOnceWith('private-response'))
})
contract('LEDG-001', 'pages the retained response cohort without losing the revision scope', async () => {
  vi.mocked(reportingApi.ledger).mockResolvedValueOnce({ ...ledger, total: 51, responses: Array.from({ length: 50 }, (_, index) => ({ ...response, id: `response-${index}` })) }).mockResolvedValueOnce({ ...ledger, total: 51 }).mockResolvedValue({ ...ledger, total: 51 })
  render(<ResponseLedger flowId="flow" revisionId="revision" timeZone="UTC" questions={[]} onChanged={vi.fn()} />)
  await screen.findByText('1–50 / 51')
  fireEvent.click(screen.getByRole('button', { name: 'Next responses' }))
  await screen.findByText('51–51 / 51')
  expect(reportingApi.ledger).toHaveBeenLastCalledWith('flow', { revisionId: 'revision', offset: 50 })
  expect(screen.getByRole('button', { name: 'Next responses' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Previous responses' }))
  await waitFor(() => expect(reportingApi.ledger).toHaveBeenLastCalledWith('flow', { revisionId: 'revision', offset: 0 }))
})
contract(['LEDG-001','LEDG-003'], 'Previous revisits exact byte-bounded pages and filter changes reset their history',async()=> {
  const pages=new Map([[0,25],[25,25],[50,21]])
  vi.mocked(reportingApi.ledger).mockImplementation(async(_flow,filter)=>({...ledger,total:71,responses:Array.from({length:pages.get(filter?.offset ?? 0)!},(_,index)=>({...response,id:`response-${(filter?.offset ?? 0)+index}`}))}))
  render(<ResponseLedger flowId="flow" revisionId="revision" timeZone="UTC" questions={[]} onChanged={vi.fn()} />)
  await screen.findByText('1–25 / 71')
  fireEvent.click(screen.getByRole('button',{name:'Next responses'}));await screen.findByText('26–50 / 71')
  fireEvent.click(screen.getByRole('button',{name:'Next responses'}));await screen.findByText('51–71 / 71')
  fireEvent.click(screen.getByRole('button',{name:'Previous responses'}));await screen.findByText('26–50 / 71')
  expect(reportingApi.ledger).toHaveBeenLastCalledWith('flow',{revisionId:'revision',offset:25})
  fireEvent.click(screen.getByRole('button',{name:'Previous responses'}));await screen.findByText('1–25 / 71')
  fireEvent.click(screen.getByRole('button',{name:'Next responses'}));await screen.findByText('26–50 / 71')
  fireEvent.change(screen.getByLabelText('Source'),{target:{value:'direct'}});await screen.findByText('1–25 / 71')
  expect(screen.getByRole('button',{name:'Previous responses'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Next responses'}));await screen.findByText('26–50 / 71')
  fireEvent.click(screen.getByRole('button',{name:'Previous responses'}));await screen.findByText('1–25 / 71')
  expect(reportingApi.ledger).toHaveBeenLastCalledWith('flow',{revisionId:'revision',offset:0,source:'direct'})
})
