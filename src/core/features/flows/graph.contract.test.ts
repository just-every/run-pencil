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
  expect(validateRevisionGraph([welcome, question, completion], choices, [{ ...rule, destinationStepStableId: 'welcome' }])).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('existing question or completion') }))
})
contract('FLOW-013', 'requires reachability and terminating default and alternative paths from the first screen', () => {
  expect(validateRevisionGraph([question, completion], choices, [])).toEqual([])
  const hidden = { ...completion, id: 'other', stableId: 'hidden', position: 2 }
  expect(validateRevisionGraph([question, completion, hidden], choices, [])).toContainEqual(expect.objectContaining({ stepId: 'hidden', reason: expect.stringContaining('reachable') }))
  expect(validateRevisionGraph([question, completion], choices, [{ ...rule, destinationStepStableId: 'q' }])).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('cycle') }))
  expect(validateRevisionGraph([{ ...question, nextStepStableId: null }, completion], choices, [])).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('default path') }))
})
contract('FLOW-014', 'validates all offending question IDs, nonempty bounded prompts, distinct choices and type limits', () => {
  for (const prompt of ['', ' ', 'x'.repeat(1001)]) expect(validateRevisionGraph([{ ...question, prompt }, completion], choices, [])).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('prompt') }))
  expect(validateRevisionGraph([{ ...question, prompt: 'x'.repeat(1000) }, completion], choices, [])).toEqual([])
  expect(validateRevisionGraph([completion], [], [])).toContainEqual(expect.objectContaining({ stepId: 'flow', reason: expect.stringContaining('at least one question') }))
  for (const questionType of ['single_choice', 'multiple_choice', 'priority'] as const) expect(validateRevisionGraph([{ ...question, questionType }, completion], [], [])).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('at least one choice') }))
  for (const duplicated of [{ ...choices[1], value: 'a' }, { ...choices[1], label: ' A ' }]) expect(validateRevisionGraph([question, completion], [choices[0], duplicated], [])).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('distinct') }))
  for (const [questionType, count] of [['single_choice', 101], ['priority', 11]] as const) {
    const options = Array.from({ length: count }, (_, i) => ({ ...choices[0], id: `row-${i}`, stableId: String(i), value: String(i), label: String(i), position: i }))
    expect(validateRevisionGraph([{ ...question, questionType }, completion], options, [])).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('choice limit') }))
  }
  const badRating = { ...question, stableId: 'rating', questionType: 'rating' as const, questionSettingsJson: '{"min":5,"max":1}' }
  const errors = validateRevisionGraph([{ ...question, prompt: '' }, badRating, completion], choices, [])
  expect(errors).toContainEqual(expect.objectContaining({ stepId: 'q', reason: expect.stringContaining('prompt') }))
  expect(errors).toContainEqual(expect.objectContaining({ stepId: 'rating', reason: expect.stringContaining('settings') }))
})
