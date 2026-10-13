import { contract } from '../../../test/contract'
import { describe, expect, it } from 'vitest'
import { composeQuestionReports, type ReportStep } from './questionReport'
const step = (revisionId: string, id = 'stable-question', questionType = 'single_choice'): ReportStep => ({ revisionId, id, prompt: 'Same wording', questionType, position: 0, reached: 2, dropped: 1 })
describe('revision-specific question evidence', () => {
  it('keeps same stable question answers and historical choice labels in their own revision', () => {
    const reports = composeQuestionReports([step('old'), step('new')], [
      { source: 'direct', revisionId: 'old', stepId: 'stable-question', valueJson: '"choice"' },
      { source: 'direct', revisionId: 'new', stepId: 'stable-question', valueJson: '"other"' },
    ], [
      { revisionId: 'old', stepId: 'stable-question', id: 'choice', label: 'Original label' },
      { revisionId: 'new', stepId: 'stable-question', id: 'choice', label: 'New label' },
      { revisionId: 'new', stepId: 'stable-question', id: 'other', label: 'Later option' },
    ])
    expect(reports[0]).toMatchObject({ revisionId: 'old', answered: 1, distribution: [{ value: 'choice', label: 'Original label', count: 1 }] })
    expect(reports[1]).toMatchObject({ revisionId: 'new', answered: 1, distribution: [{ value: 'choice', label: 'New label', count: 0 }, { value: 'other', label: 'Later option', count: 1 }] })
  })
  it('does not create absent old questions or merge different IDs with identical prompts', () => {
    const reports = composeQuestionReports([step('old'), step('new'), step('new', 'different-question')], [
      { source: 'direct', revisionId: 'old', stepId: 'stable-question', valueJson: '"choice"' },
      { source: 'direct', revisionId: 'new', stepId: 'different-question', valueJson: '"choice"' },
    ], [])
    expect(reports.map(report => [report.revisionId, report.id, report.answered])).toEqual([['old', 'stable-question', 1], ['new', 'stable-question', 0], ['new', 'different-question', 1]])
  })
  it('keeps changed answer types and multiple-select or priority denominators separate', () => {
    const reports = composeQuestionReports([step('old', 'stable-question', 'multiple_choice'), step('new', 'stable-question', 'priority')], [
      { source: 'direct', revisionId: 'old', stepId: 'stable-question', valueJson: '["a","b"]' },
      { source: 'direct', revisionId: 'new', stepId: 'stable-question', valueJson: '["b","a"]' },
    ], ['old', 'new'].flatMap(revisionId => ['a', 'b'].map(id => ({ revisionId, stepId: 'stable-question', id, label: id }))))
    expect(reports[0]).toMatchObject({ answered: 1, distributionLabel: 'Multiple select; shares may total more than 100%.', distribution: [{ count: 1 }, { count: 1 }] })
    expect(reports[1]).toMatchObject({ answered: 1, distributionLabel: 'First-priority choices.', distribution: [{ count: 0 }, { count: 1 }] })
  })
  it('returns exact retained text for authenticated summaries without response identity', () => {
    const report = composeQuestionReports([step('old', 'stable-question', 'long_text')], [{ source: 'direct', revisionId: 'old', stepId: 'stable-question', valueJson: '"private exact answer"' }], [])
    expect(report[0]).toMatchObject({ answered: 1, distribution: [], reached: 2, dropped: 1 })
    expect(report[0].summary.texts).toEqual(['private exact answer'])
    expect(JSON.stringify(report)).not.toContain('responseId')
  })
})
contract(['RSLT-002', 'RSLT-005'], 'retains imported answer shares within each containing revision without turning imports into session evidence', () => {
  const reports = composeQuestionReports([step('old'), step('new')], [
    { source: 'imported', revisionId: 'old', stepId: 'stable-question', valueJson: '"a"' },
    { source: 'imported', revisionId: 'old', stepId: 'stable-question', valueJson: '"b"' },
    { source: 'direct', revisionId: 'new', stepId: 'stable-question', valueJson: '"a"' },
  ], ['old', 'new'].flatMap(revisionId => ['a', 'b'].map(id => ({ revisionId, stepId: 'stable-question', id, label: id }))))
  expect(reports[0]).toMatchObject({ answered: 2, importedAnswered: 2, distribution: [{ count: 1 }, { count: 1 }] })
  expect(reports[1]).toMatchObject({ answered: 1, importedAnswered: 0, distribution: [{ count: 1 }, { count: 0 }] })
})
