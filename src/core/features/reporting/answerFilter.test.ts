import { DatabaseSync } from 'node:sqlite'
import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { structuredAnswerFilter } from './answerFilter'

function matches(type: string, values: unknown[], filter: string) {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec('CREATE TABLE responses(id TEXT, revision_id TEXT); CREATE TABLE response_answers(response_id TEXT, step_id TEXT, value_json TEXT); CREATE TABLE flow_steps(revision_id TEXT, stable_id TEXT, question_type TEXT);')
    db.prepare('INSERT INTO flow_steps VALUES (?, ?, ?)').run('revision', 'question', type)
    values.forEach((value, index) => {
      db.prepare('INSERT INTO responses VALUES (?, ?)').run(String(index), 'revision')
      db.prepare('INSERT INTO response_answers VALUES (?, ?, ?)').run(String(index), 'question', JSON.stringify(value))
    })
    const query = structuredAnswerFilter('question', filter)
    return db.prepare(`SELECT r.id FROM responses r WHERE ${query.sql} ORDER BY r.id`).all(...query.bindings).map(row => Number(row.id))
  } finally { db.close() }
}

contract(['LEDG-003', 'LEDG-004', 'FLOW-019'], 'SQLite boolean predicates distinguish yes/no and the retained consent decision from numeric or string lookalikes', () => {
  const booleans = [true, false, 1, 0, 'true', 'false', null]
  expect(matches('yes_no', booleans, 'true')).toEqual([0])
  expect(matches('yes_no', booleans, 'false')).toEqual([1])
  const consents = booleans.map(accepted => ({ accepted, statement: 'The statement stays intact.' }))
  expect(matches('consent', consents, 'true')).toEqual([0])
  expect(matches('consent', consents, 'false')).toEqual([1])
  for (const invalid of ['1', '0', 'TRUE', 'yes', '', '{"accepted":true}', "true' OR 1=1--"]) {
    expect(matches('yes_no', booleans, invalid)).toEqual([])
    expect(matches('consent', consents, invalid)).toEqual([])
  }
})

contract(['LEDG-003', 'FLOW-019'], 'finite numeric equality accepts equivalent decimals without coercing incomplete or nonnumeric filter values', () => {
  for (const type of ['number', 'nps', 'rating']) {
    expect(matches(type, [0, 5, 11, -1.5, '11', true], '11.0')).toEqual([2])
    expect(matches(type, [0, 5, 11, -1.5, '11', true], '0.0')).toEqual([0])
    expect(matches(type, [0, 5, 11, -1.5, '11', true], '5e0')).toEqual([1])
    for (const invalid of ['', ' ', '0x0', '11junk', '11\n', 'NaN', 'Infinity', '1e999', '--1', '1 OR 1=1', 'null']) expect(matches(type, [0, 1, 11], invalid)).toEqual([])
  }
  expect(matches('number', [-1.5, 1.5], '-1.50')).toEqual([0])
  expect(matches('number', [0, 0.5, -0.5], '.5')).toEqual([1])
  expect(matches('number', [0, 0.5, -0.5], '-.5')).toEqual([2])
})

contract(['LEDG-003', 'FLOW-019'], 'calendar equality preserves leap days without interpreting instants or invalid calendar strings', () => {
  const dates = ['2024-02-29', '2024-03-01', '2023-02-29', '2024-02-29T00:00:00Z']
  expect(matches('date', dates, '2024-02-29')).toEqual([0])
  for (const invalid of ['2023-02-29', '2024-2-29', '2024-02-29T00:00:00Z', '2024-02-29T10:00:00+10:00', '', '0']) expect(matches('date', dates, invalid)).toEqual([])
})

contract(['LEDG-003', 'FLOW-019'], 'email remains case insensitive and choices retain exact stable-ID equality and membership', () => {
  expect(matches('email', ['Mixed.Case@Example.test', 'other@example.test'], 'mixed.case@example.TEST')).toEqual([0])
  for (const type of ['single_choice', 'dropdown']) {
    expect(matches(type, ['choice-a', 'choice-ab', 'Choice-a'], 'choice-a')).toEqual([0])
    expect(matches(type, ['choice-a'], 'Choice-a')).toEqual([])
  }
  for (const type of ['multiple_choice', 'priority']) {
    expect(matches(type, [['choice-a', 'choice-b'], ['choice-b', 'choice-a'], ['choice-ab']], 'choice-a')).toEqual([0, 1])
    expect(matches(type, [['choice-a', 'choice-b']], 'choice')).toEqual([])
  }
})
