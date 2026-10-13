import { expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { contract } from '../../../test/contract'
import { prepareImport } from './prepare'
import { reviewResponse } from './review-response'
import { ReviewReport } from './ui/ReviewReport'
import type { ImportReview, RowError } from './model'

const definition = JSON.stringify({ title: 'Invalid responses', fields: Array.from({ length: 49 }, (_, i) => ({ ref: `q${i}`, title: `Question ${i}`, type: 'yes_no' })) })
const input = { definition, csv: Array.from({ length: 49 }, (_, i) => `Question ${i}`).join(',') + '\n' + Array.from({ length: 101 }, () => Array(49).fill('x').join(',')).join('\n'), plannedAt: '2026-10-08T00:00:00.000Z' }
const expected: RowError[] = Array.from({ length: 101 }, (_, index) => [
  ...Array.from({ length: 49 }, (_, column) => ({ row: index + 2, column: `Question ${column}`, message: 'Use 1/0 or true/false.' })),
  { row: index + 2, column: 'Submission time', message: 'Map a nonempty original submission timestamp; times are never invented.' },
]).flat()

function review(): ImportReview {
  const p = prepareImport(input, 'workspace')
  return { plannedAt: p.plannedAt, flowId: p.flowId, title: p.form.title, report: p.form.report, questions: p.form.steps, headers: p.headers, columns: p.columns, forbiddenColumns: p.forbiddenColumns, rowErrors: p.rowErrors, responseCount: p.responseCount, fingerprint: 'review', lossRequired: true, alreadyImported: false, heldByOtherOperator: false }
}

contract(['IMPORT-002', 'IMPORT-003'], 'retains every ordered diagnostic once for reports and rejected source rows without aliases', () => {
  const p = prepareImport(input, 'workspace')
  expect(p.responseCount).toBe(0)
  expect(Array.from(p.rowErrors)).toEqual(expected)
  expect(p.rowErrors.map(error => error.row)).toEqual(expected.map(error => error.row))
  expect(JSON.parse(JSON.stringify(p.rowErrors))).toEqual(expected)
  expect(p.source.records).toHaveLength(102)
  for (let row = 2; row <= 102; row++) expect(p.source.records[row - 1].payload).toEqual({ row, errors: expected.filter(error => error.row === row) })
  p.rowErrors[0].message = 'mutated reader'
  ;(p.source.records[1].payload as any).errors[0].column = 'mutated source reader'
  expect(p.rowErrors[0]).toEqual(expected[0])
  expect((p.source.records[1].payload as any).errors[0]).toEqual(expected[0])
})

contract(['IMPORT-002', 'IMPORT-003'], 'streams the full expanded review in bounded JSON chunks', async () => {
  const value = review(), reader = reviewResponse(value).getReader(), decoder = new TextDecoder(), chunks: string[] = []
  for (;;) { const { done, value } = await reader.read(); if (done) break; expect(value.byteLength).toBeLessThanOrEqual(128 * 1024); chunks.push(decoder.decode(value, { stream: true })) }
  expect(chunks.length).toBeGreaterThan(1)
  expect(JSON.parse(chunks.join('')).rowErrors).toEqual(expected)
})

contract(['IMPORT-002', 'BASE-PUBLIC-003'], 'renders a bounded error page with access to all remaining diagnostics', () => {
  const value = review(), html = renderToStaticMarkup(createElement(ReviewReport, { review: value, columns: value.columns, change() {}, busy: false }))
  expect(html.match(/<li>/g)).toHaveLength(100)
  expect(html).toContain('Next errors')
  expect(html).toContain('5050')
})
