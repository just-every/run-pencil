import { contract } from '../../../test/contract'
import { describe, expect, it } from 'vitest'
import { resolveNextStep, validateRevisionGraph } from './graph'
import type { StoredBranchRule, StoredChoice, StoredStep } from './repository'

const timestamp = '2026-09-08T00:00:00.000Z'

function step(input: Partial<StoredStep> & Pick<StoredStep, 'id' | 'stableId' | 'position' | 'kind' | 'prompt'>): StoredStep {
  return {
    questionType: input.kind === 'question' ? 'single_choice' : null,
    helperText: null,
    required: input.kind === 'question',
    nextStepStableId: null,
    questionSettingsJson: null,
    revisionId: 'revision-1',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input,
  }
}

function rule(input: Partial<StoredBranchRule> & Pick<StoredBranchRule, 'id' | 'sourceStepStableId' | 'destinationStepStableId'>): StoredBranchRule {
  return {
    revisionId: 'revision-1',
    predicateKind: 'equals',
    expectedValueJson: JSON.stringify('choice-yes'),
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input,
  }
}

const choices: StoredChoice[] = [
  { id: 'choice-row-yes', stepId: 'question-row', stableId: 'choice-yes', value: 'yes', label: 'Yes', position: 0, createdAt: timestamp, updatedAt: timestamp },
  { id: 'choice-row-no', stepId: 'question-row', stableId: 'choice-no', value: 'no', label: 'No', position: 1, createdAt: timestamp, updatedAt: timestamp },
]

describe('published flow graph', () => {
  contract(['FLOW-005'], 'uses the first matching branch in displayed order before the default path', () => {
    const question = step({ id: 'question-row', stableId: 'question', position: 0, kind: 'question', prompt: 'Did it help?', nextStepStableId: 'default-completion' })
    const selection = resolveNextStep({
      step: question,
      answers: { question: 'choice-yes' },
      rules: [
        rule({ id: 'first-match', sourceStepStableId: 'question', destinationStepStableId: 'yes-completion' }),
        rule({ id: 'later-match', sourceStepStableId: 'question', destinationStepStableId: 'later-completion' }),
      ],
    })
    expect(selection.selectedRuleId).toBe('first-match')
    expect(selection.nextStepId).toBe('yes-completion')
    expect(selection.evaluations).toEqual([
      { ruleId: 'first-match', matched: true, destinationStepId: 'yes-completion' },
      { ruleId: 'later-match', matched: true, destinationStepId: 'later-completion' },
    ])
  })

  it('rejects a published graph whose possible branch path never terminates', () => {
    const question = step({ id: 'question-row', stableId: 'question', position: 0, kind: 'question', prompt: 'Did it help?', nextStepStableId: 'default-completion' })
    const completion = step({ id: 'completion-row', stableId: 'default-completion', position: 1, kind: 'completion', prompt: 'Thank you' })
    const issues = validateRevisionGraph([question, completion], choices, [rule({ id: 'cycle', sourceStepStableId: 'question', destinationStepStableId: 'question' })])
    expect(issues).toContainEqual(expect.objectContaining({ stepId: 'question', reason: expect.stringContaining('cycle') }))
  })

  it('rejects a branch predicate that refers to a missing stable choice', () => {
    const question = step({ id: 'question-row', stableId: 'question', position: 0, kind: 'question', prompt: 'Did it help?', nextStepStableId: 'completion' })
    const completion = step({ id: 'completion-row', stableId: 'completion', position: 1, kind: 'completion', prompt: 'Thank you' })
    const issues = validateRevisionGraph([question, completion], choices, [rule({ id: 'missing-choice', sourceStepStableId: 'question', destinationStepStableId: 'completion', expectedValueJson: JSON.stringify('gone') })])
    expect(issues).toContainEqual(expect.objectContaining({ stepId: 'question', reason: expect.stringContaining('stable choices') }))
  })
})
