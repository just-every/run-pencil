import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { additionalQuestionTypes, insertStep, originalQuestionTypes, seedQuestionSchemaFixture } from './question-schema-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const migrationName = '0018_question_types.sql'
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`

async function snapshot() {
  const tables = (await env.DB.prepare(`SELECT name FROM sqlite_schema
    WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' AND name!='d1_migrations'
    ORDER BY name`).all<{ name: string }>()).results
  return Promise.all(tables.map(async ({ name }) => {
    const columns = (await env.DB.prepare(`PRAGMA table_info(${quote(name)})`).all()).results
    const foreignKeys = (await env.DB.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all()).results
    const indices = (await env.DB.prepare(`PRAGMA index_list(${quote(name)})`).all<{ name: string; unique: number; origin: string; partial: number }>()).results
    const indexes = await Promise.all(indices.map(async ({ name: indexName, unique, origin, partial }) => ({
      name: indexName, unique, origin, partial,
      columns: (await env.DB.prepare(`PRAGMA index_xinfo(${quote(indexName)})`).all()).results,
    })))
    return {
      name, columns, foreignKeys, indexes: indexes.sort((a, b) => a.name.localeCompare(b.name)),
      rows: (await env.DB.prepare(`SELECT * FROM ${quote(name)} ORDER BY ${columns.map(column => quote(String(column.name))).join(',')}`).all()).results,
    }
  }))
}

contract(['BASE-OPS-002', 'BASE-DATA-002', 'FLOW-003', 'FLOW-008', 'FLOW-015', 'FLOW-021'], 'question type migration preserves populated revisions, choices, branches, answers and all constraints atomically', async () => {
  const migration = __PENCIL_CORE_MIGRATIONS__.find(item => item.name === migrationName)
  expect(migration).toBeDefined()
  const previous = __PENCIL_CORE_MIGRATIONS__.filter(item => item.name < migrationName)
  await applyD1Migrations(env.DB, previous)
  await seedQuestionSchemaFixture()
  const before = await snapshot()
  for (const [name, count] of Object.entries({ flow_revisions: 3, flow_steps: 27, choice_options: 18, flow_branch_rules: 3, responses: 2, response_answers: 4, respondent_sessions: 2 })) {
    expect(before.find(table => table.name === name)?.rows).toHaveLength(count)
  }
  // Inspect every table, including future migrations, so an additional referencing
  // child cannot silently invalidate the drop order or disappear in a cascade.
  const inbound = before.flatMap(table => table.foreignKeys
    .filter(key => key.table === 'flow_steps' || key.table === 'choice_options')
    .map(key => ({ fromTable: table.name, ...key })))
  expect(inbound).toEqual([{
    fromTable: 'choice_options', id: 0, seq: 0, table: 'flow_steps', from: 'step_id', to: 'id',
    on_update: 'NO ACTION', on_delete: 'NO ACTION', match: 'NONE',
  }])
  const otherSchema = () => env.DB.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('view','trigger') ORDER BY type,name").all()
  const schemaBefore = (await otherSchema()).results
  const ledgerBefore = (await env.DB.prepare('SELECT * FROM d1_migrations ORDER BY id').all()).results
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  await expect(insertStep('too-early', 100, 'dropdown').run()).rejects.toThrow(/CHECK constraint failed/)

  // Failure after the rebuild must roll back both rows/schema and the ledger.
  await expect(applyD1Migrations(env.DB, [{ ...migration!, queries: [
    ...migration!.queries, "UPDATE flow_steps SET question_type='invalid-question-type' WHERE id='old-1'",
  ] }])).rejects.toThrow(/CHECK constraint failed/)
  expect(await snapshot()).toEqual(before)
  expect((await otherSchema()).results).toEqual(schemaBefore)
  expect((await env.DB.prepare('SELECT * FROM d1_migrations ORDER BY id').all()).results).toEqual(ledgerBefore)

  await applyD1Migrations(env.DB, [migration!])
  expect(await snapshot()).toEqual(before)
  expect((await otherSchema()).results).toEqual(schemaBefore)
  const links = await env.DB.prepare(`SELECT r.id response_id,r.revision_id,a.id answer_id,a.step_id,
      s.id step_row_id,s.stable_id,c.id choice_row_id,c.stable_id choice_stable_id,b.destination_step_stable_id
    FROM responses r JOIN response_answers a ON a.response_id=r.id
    JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id
    JOIN choice_options c ON c.step_id=s.id AND c.stable_id=json_extract(a.value_json,'$')
    JOIN flow_branch_rules b ON b.revision_id=r.revision_id AND b.source_step_stable_id=s.stable_id
    ORDER BY r.id`).all()
  expect(links.results).toEqual(['current', 'old'].map(revision => ({
    response_id: `response-${revision}`, revision_id: `revision-${revision}`, answer_id: `answer-${revision}`,
    step_id: 'stable-4', step_row_id: `${revision}-4`, stable_id: 'stable-4',
    choice_row_id: `${revision}-4-choice-1`, choice_stable_id: 'stable-choice-4-1', destination_step_stable_id: 'stable-8',
  })))
  for (const [position, type] of [...originalQuestionTypes, ...additionalQuestionTypes].entries()) {
    await insertStep(`accepted-${type}`, 100 + position, type).run()
  }
  expect((await env.DB.prepare("SELECT question_type FROM flow_steps WHERE id LIKE 'accepted-%' ORDER BY position").all()).results)
    .toEqual([...originalQuestionTypes, ...additionalQuestionTypes].map(question_type => ({ question_type })))
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  expect((await env.DB.prepare('PRAGMA quick_check').all()).results).toEqual([{ quick_check: 'ok' }])
  const after = await snapshot()
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__.filter(item => item.name <= migrationName))
  expect(await snapshot()).toEqual(after)
  const ledger = (await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{ name: string }>()).results
  expect(ledger.map(row => row.name)).toEqual([...previous.map(item => item.name), migrationName])
  await assertRetainedConstraints()
})

// Exercise the same upgraded database. The native runner retains storage within
// this file, and a second seed would collide with its already preserved rows.
async function assertRetainedConstraints() {
  const before = await snapshot()
  for (const column of ['id', 'revision_id', 'position', 'kind', 'prompt', 'required', 'created_at', 'updated_at']) {
    await expect(env.DB.prepare(`UPDATE flow_steps SET ${quote(column)}=NULL WHERE id='old-1'`).run()).rejects.toThrow(/NOT NULL constraint failed/)
  }
  for (const assignment of ["question_type='not-supported'", "kind='not-supported'", 'required=2']) {
    await expect(env.DB.prepare(`UPDATE flow_steps SET ${assignment} WHERE id='old-1'`).run()).rejects.toThrow(/CHECK constraint failed/)
  }
  for (const assignment of ["id='old-2'", 'position=2', "stable_id='stable-2'"]) {
    await expect(env.DB.prepare(`UPDATE flow_steps SET ${assignment} WHERE id='old-1'`).run()).rejects.toThrow(/UNIQUE constraint failed/)
  }
  await expect(env.DB.prepare("UPDATE flow_steps SET revision_id='missing-revision' WHERE id='old-1'").run()).rejects.toThrow(/FOREIGN KEY constraint failed/)
  await expect(env.DB.prepare("DELETE FROM flow_steps WHERE id='old-4'").run()).rejects.toThrow(/FOREIGN KEY constraint failed/)
  await expect(env.DB.prepare("UPDATE choice_options SET step_id='missing-step' WHERE id='old-4-choice-0'").run()).rejects.toThrow(/FOREIGN KEY constraint failed/)
  for (const column of ['id', 'step_id', 'value', 'label', 'position', 'created_at', 'updated_at']) {
    await expect(env.DB.prepare(`UPDATE choice_options SET ${quote(column)}=NULL WHERE id='old-4-choice-0'`).run()).rejects.toThrow(/NOT NULL constraint failed/)
  }
  for (const assignment of ["id='old-4-choice-1'", "value='value-1'", 'position=1', "stable_id='stable-choice-4-1'"]) {
    await expect(env.DB.prepare(`UPDATE choice_options SET ${assignment} WHERE id='old-4-choice-0'`).run()).rejects.toThrow(/UNIQUE constraint failed/)
  }
  expect(await snapshot()).toEqual(before)
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
}
