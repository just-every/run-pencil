// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import { contract } from './contract'
import { QuarantineReview } from '../core/features/results/ui/QuarantineReview'
import { api, type QuestionReport } from '../core/app/api'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
contract(['LEDG-002', 'WS-001'], 'quarantine displays typed historical labels, immutable consent and workspace dates without raw identifiers', async () => {
  const identifier = '01J00000000000000000000001'
  vi.spyOn(api, 'quarantinedResponses').mockResolvedValue([{ id: identifier, completedAt: '2024-02-01T23:00:00Z', quarantineReason: 'Completed quickly', answers: [{ stepId: 'dropdown', value: identifier }, { stepId: 'boolean', value: false }, { stepId: 'consent', value: { accepted: true, statement: 'Exact published consent statement' } }] }])
  const question = (id: string, questionType: string): QuestionReport => ({ id, prompt: `Question ${id}`, questionType, reached: 1, dropped: 0, answered: 0, importedAnswered: 0, choices: [{ id: identifier, label: 'Coffee' }], distribution: [], distributionLabel: '', summary: {} })
  render(<QuarantineReview revisionId="revision" timeZone="Australia/Brisbane" questions={[question('dropdown', 'dropdown'), question('boolean', 'yes_no'), question('consent', 'consent')]} onChanged={vi.fn()} />)
  expect(await screen.findByText('Coffee', { exact: true })).toBeInTheDocument()
  expect(screen.getByText('No', { exact: true })).toBeInTheDocument()
  expect(screen.getByText(/Accepted.*Exact published consent statement/)).toBeInTheDocument()
  expect(screen.getByText(/Submitted.*(?:Feb 2|2 Feb)/)).toBeInTheDocument()
  expect(document.body.textContent).not.toContain(identifier)
})
