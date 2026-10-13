// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { AnswerEvidence } from '../core/features/results/ui/AnswerEvidence'
import { reportingApi, type QuestionReport } from '../core/app/api'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const question: QuestionReport = { revisionId: 'revision', importedAnswered: 0, id: 'q', prompt: 'Comments', questionType: 'long_text', reached: 12, dropped: 0, answered: 12, choices: [], distribution: [], distributionLabel: 'One answer per response.', summary: { texts: Array.from({ length: 12 }, (_, index) => `Exact answer ${index}`) } }
contract(['RSLT-001', 'RSLT-002'], 'searches every retained answer beyond the first page and reveals exact text on demand', async () => {
  vi.spyOn(reportingApi,'textPage').mockImplementation(async (_flow, input) => {
    const matches = question.summary.texts!.filter(text => text.toLowerCase().includes(input.search.toLowerCase()))
    const offset = Number(input.cursor ?? 0), texts = matches.slice(offset,offset+5)
    return { texts, matching:matches.length, scanning: false, ...(offset+texts.length < matches.length ? {cursor:String(offset+texts.length)} : {}) }
  })
  render(<AnswerEvidence flowId="flow" question={question} />)
  expect(await screen.findByText('Exact answer 0')).toBeInTheDocument()
  expect(screen.queryByText('Exact answer 11')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search answers' }), { target: { value: 'answer 11' } })
  expect(await screen.findByText('Exact answer 11')).toBeInTheDocument()
  expect(await screen.findByText('1 matching answer · latest first · 1 on this page')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
  fireEvent.click(await screen.findByRole('button', { name: 'Show more answers' }))
  expect(await screen.findByText('Exact answer 11')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Show more answers' })).not.toBeInTheDocument()
})
contract('RSLT-002', 'uses singular answer language and full width labelled multiple select bars', () => {
  render(<AnswerEvidence flowId="flow" question={{ ...question, questionType: 'multiple_choice', answered: 1, importedAnswered: 0, summary: {}, distributionLabel: 'Multiple select; shares may total more than 100%.', distribution: [{ value: 'a', label: 'Coffee', count: 1 }, { value: 'b', label: 'Tea', count: 1 }] }} />)
  expect(screen.getAllByText('1 of 1 answer · 100%')).toHaveLength(2)
  expect(screen.getByText(/Multiple select/)).toBeInTheDocument()
  expect(document.querySelectorAll('.device-bar')).toHaveLength(2)
  for (const bar of document.querySelectorAll<HTMLElement>('.device-bar')) expect(bar.style.width).toBe('100%')
})
contract('RSLT-001', 'shows the exact fractional median without rounding away stored number precision', () => {
  render(<AnswerEvidence flowId="flow" question={{ ...question, questionType: 'number', answered: 2, summary: { minimum: .01, median: .015, maximum: .02 } }} />)
  expect(screen.getByText('0.015')).toBeInTheDocument()
  expect(screen.queryByText('0.0')).not.toBeInTheDocument()
})
contract(['RSLT-001','RSLT-003'], 'shows the complete count independently of the text page and ignores an obsolete count response',async()=> {
  let finishOld!: (value:{texts:string[];scanning:boolean;matching:number})=>void
  vi.spyOn(reportingApi,'textPage').mockImplementation(async(_flow,input)=> {
    if(input.countOnly && input.search==='') return new Promise(resolve=>{finishOld=resolve})
    if(input.countOnly) return {texts:[],scanning:false,matching:71}
    return {texts:Array.from({length:5},(_,index)=>`${input.search || 'Old'} answer ${index}`),scanning:false,countCursor:'count'}
  })
  render(<AnswerEvidence flowId="flow" question={question} />)
  expect(await screen.findByText('Old answer 0')).toBeInTheDocument()
  expect(screen.getByText(/Counting all matching answers/)).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'É%_'}})
  expect(await screen.findByText('71 matching answers · latest first · 5 on this page')).toBeInTheDocument()
  finishOld({texts:[],scanning:false,matching:999})
  expect(await screen.findByText('É%_ answer 0')).toBeInTheDocument()
  expect(screen.getByText('71 matching answers · latest first · 5 on this page')).toBeInTheDocument()
  expect(screen.queryByText(/999 matching/)).not.toBeInTheDocument()
})
contract(['RSLT-001', 'RSLT-002'], 'uses the full matching text count for singular and plural answer language', async () => {
  let finishSingleCount!: (value: { texts: string[]; scanning: boolean; matching: number }) => void
  vi.spyOn(reportingApi, 'textPage').mockImplementation(async (_flow, input) => {
    if (input.countOnly) {
      if (input.search === 'first') return new Promise(resolve => { finishSingleCount = resolve })
      return { texts: [], scanning: false, matching: input.search === 'missing' ? 0 : 2 }
    }
    const matches = input.search === 'missing' ? [] : input.search === 'first' ? ['shared first'] : ['shared first', 'shared second']
    return { texts: matches.slice(0, input.search === '' ? 1 : 5), countCursor: 'count', scanning: false }
  })
  render(<AnswerEvidence flowId="flow" question={question} />)
  const search = screen.getByRole('searchbox', { name: 'Search answers' })
  expect(await screen.findByText('2 matching answers · latest first · 1 on this page')).toBeInTheDocument()
  expect(screen.getByText('shared first')).toBeInTheDocument()
  expect(screen.queryByText('shared second')).not.toBeInTheDocument()

  fireEvent.change(search, { target: { value: 'first' } })
  expect(await screen.findByText('Counting all matching answers… · 1 on this page')).toBeInTheDocument()
  finishSingleCount({ texts: [], scanning: false, matching: 1 })
  expect(await screen.findByText('1 matching answer · latest first · 1 on this page')).toBeInTheDocument()
  expect(screen.getByText('shared first')).toBeInTheDocument()

  fireEvent.change(search, { target: { value: 'missing' } })
  expect(await screen.findByText('0 matching answers · latest first · 0 on this page')).toBeInTheDocument()
  expect(screen.queryByText('shared first')).not.toBeInTheDocument()
})
