import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { reachableDestinations } from './reachable-destinations'
import type { StoredStep, StoredBranchRule } from './repository'
const step: StoredStep = { id: 'row', stableId: 'q', revisionId: 'r', position: 0, kind: 'question', questionType: 'number', prompt: 'Question', required: true, helperText: null, nextStepStableId: 'default', questionSettingsJson: null, createdAt: '', updatedAt: '' }
const rule = (kind: StoredBranchRule['predicateKind'], value: unknown, destination = 'matched', position = 0): StoredBranchRule => ({ id: destination, revisionId: 'r', sourceStepStableId: 'q', destinationStepStableId: destination, position, predicateKind: kind, expectedValueJson: JSON.stringify(value), createdAt: '', updatedAt: '' })
contract('FLOW-005', 'computes reachable number, date, NPS and boolean branches over valid domains and ordering', () => {
  expect(reachableDestinations(step, [], { min: -2, max: 2, decimalPlaces: 2 }, [rule('equals', -1.25)], 'first-matching-rule')).toEqual(['matched', 'default'])
  expect(reachableDestinations(step, [], { min: 0, max: Number.MIN_VALUE }, [rule('greater_than', 0)], 'first-matching-rule')).toEqual(['matched', 'default'])
  expect(reachableDestinations(step, [], { min: 0, max: 0, decimalPlaces: 0 }, [rule('equals', 0)], 'first-matching-rule')).toEqual(['matched'])
  expect(reachableDestinations({ ...step, questionType: 'date' }, [], { earliest: '2024-02-29', latest: '2024-02-29' }, [rule('equals', '2024-02-29')], 'first-matching-rule')).toEqual(['matched'])
  expect(reachableDestinations({ ...step, questionType: 'yes_no' }, [], {}, [rule('equals', false)], 'first-matching-rule')).toEqual(['matched', 'default'])
  expect(reachableDestinations({ ...step, questionType: 'consent' }, [], { statement: 'Agreed' }, [rule('equals', false)], 'first-matching-rule')).toEqual(['default'])
  expect(reachableDestinations({ ...step, questionType: 'nps' }, [], {}, [rule('equals', 0), rule('equals', 10, 'ten', 1)], 'first-matching-rule')).toEqual(['matched', 'ten', 'default'])
  const rules = [rule('greater_than_or_equal', 0, 'first'), rule('greater_than_or_equal', 0, 'last', 1)]
  expect(reachableDestinations({ ...step, questionType: 'nps' }, [], {}, rules, 'first-matching-rule')).toEqual(['first'])
  expect(reachableDestinations({ ...step, questionType: 'nps' }, [], {}, rules, 'last-matching-rule')).toEqual(['last'])
})
