import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { validateRevisionGraph } from './graph'
import type { StoredStep, StoredChoice, StoredBranchRule } from './repository'
const now = '2026-10-06T00:00:00.000Z'
const question = { id: 'row-q', revisionId: 'r', stableId: 'q', position: 0, kind: 'question', questionType: 'single_choice', prompt: 'Choose', helperText: null, required: true, nextStepStableId: 'done', questionSettingsJson: null, createdAt: now, updatedAt: now } satisfies StoredStep
const completion = { ...question, id: 'row-done', stableId: 'done', position: 1, kind: 'completion', questionType: null, prompt: 'Done', required: false, nextStepStableId: null } satisfies StoredStep
const choices = ['a', 'b'].map((id, position) => ({ id: `row-${id}`, stableId: id, stepId: question.id, value: id, label: id, position, createdAt: now, updatedAt: now })) satisfies StoredChoice[]
const rule = { id: 'branch', revisionId: 'r', sourceStepStableId: 'q', destinationStepStableId: 'done', position: 0, predicateKind: 'equals', expectedValueJson: '"a"', createdAt: now, updatedAt: now } satisfies StoredBranchRule
contract('FLOW-012', 'rejects absent, nonquestion and incompatible branch sources, choices and destinations by stable ID', () => {
  expect(validateRevisionGraph([question, completion], choices, [rule])).toEqual([])
  for (const change of [{ sourceStepStableId: 'gone' }, { sourceStepStableId: 'done' }, { destinationStepStableId: 'gone' }, { expectedValueJson: '"gone"' }]) {
    expect(validateRevisionGraph([question, completion], choices, [{ ...rule, ...change }])).toContainEqual(expect.objectContaining({ stepId: change.sourceStepStableId ?? 'q', reason: expect.any(String) }))
  }
  const welcome = { ...completion, kind: 'welcome' as const, stableId: 'welcome', position: -1, nextStepStableId: 'q' }
  expect(validateRevisionGraph([welcome, question, completion], choices, [{ ...rule, destinationStepStableId: 'welcome' }])).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('existing question, payment step or completion') }))
})
