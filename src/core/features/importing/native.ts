import { retainedSql } from '../../../base/import-kit/src/d1/index'
import { importPlanCodec } from './plan-codec'
import { nativeRowChunks } from './native-chunks'
import manifest from '../../../../seed.json'
import type { D1Database, D1TargetAdapter, TargetRow, Json, D1Sql } from '../../../base/import-kit/src/d1/index'
import { tableNames, tables, optionalNativeTables, nativeSnapshotRows, type NativeRow, type NativeValue } from './native-tables'
type ImportTargetRow = TargetRow & { committedAt?: string }
const query = (sql: string, ...params: any[]): D1Sql => ({ sql, params })
async function read(db: D1Database, destination: string, kind: string, id: string): Promise<TargetRow | undefined> {
  const metadata = await db.prepare('SELECT * FROM form_import_targets WHERE target_id = ? AND workspace_id = ? AND kind = ?').bind(id, destination, kind).first<{ flow_id: string; revision: string; committed_at: string }>()
  if (!metadata) return undefined
  const snapshot: NativeValue = { flowId: metadata.flow_id, tables: {} }
  for (const name of tableNames(kind)) {
    const rows = nativeSnapshotRows(name, (await db.prepare(`SELECT ${tables[name].columns.join(',')} FROM ${name} WHERE ${tables[name].scope} ORDER BY ${name === 'submission_tags' ? 'response_id,tag' : tables[name].columns[0]}`).bind(id).all<NativeRow>()).results)
    if (rows.length || !optionalNativeTables.has(name)) snapshot.tables[name] = nativeSnapshotRows(name, rows)
  }
  return { destination, targetKind: kind, targetId: id, revision: metadata.revision, value: snapshot as unknown as Json, committedAt: metadata.committed_at } as ImportTargetRow
}
function nativePredicates(row: TargetRow | null, destination: string, kind: string, id: string): D1Sql[] {
  const names = tableNames(kind)
  if (!row) return [query(`NOT EXISTS (SELECT 1 FROM form_import_targets WHERE target_id = ?) AND NOT EXISTS (SELECT 1 FROM form_import_native_epochs WHERE target_id = ?) AND ${names.map(name => `NOT EXISTS (SELECT 1 FROM ${name} WHERE ${tables[name].scope})`).join(' AND ')}`, id, id, ...names.map(() => id))]
  const value = row.value as unknown as NativeValue
  const predicates = [query('EXISTS (SELECT 1 FROM form_import_targets WHERE target_id = ? AND workspace_id = ? AND kind = ? AND revision = ? AND flow_id = ?)', id, destination, kind, row.revision, value.flowId)]
  const committedAt = (row as ImportTargetRow).committedAt
  if (committedAt !== undefined) predicates.push(query('EXISTS (SELECT 1 FROM form_import_targets WHERE target_id = ? AND committed_at = ?)', id, committedAt))
  for (const name of names) {
    const spec = tables[name], rows = value.tables[name] ?? []
    predicates.push(query(`(SELECT COUNT(*) FROM ${name} WHERE ${spec.scope}) = ?`, id, rows.length))
    for (const chunk of nativeRowChunks(rows)) predicates.push(retainedSql(['NOT EXISTS (SELECT 1 FROM json_each(', `) expected WHERE NOT EXISTS (SELECT 1 FROM ${name} native WHERE ${spec.columns.map(column => `native.${column} IS json_extract(expected.value,'$.${column}')`).join(' AND ')}))`], [chunk], [0]))
  }
  return predicates
}
export const importTargets: D1TargetAdapter = {
  planCodec: importPlanCodec,
  read,
  async stagingRead(db, destination, kind, id) {
    const epoch = await db.prepare('SELECT revision FROM form_import_native_epochs WHERE target_id=?').bind(id).first<{revision:number}>()
    const row = await read(db,destination,kind,id)
    return {row,guards:[query('coalesce((SELECT revision FROM form_import_native_epochs WHERE target_id=?),0)=?',id,epoch?.revision ?? 0), ...row ? [] : nativePredicates(null,destination,kind,id)]}
  },
  stagingPublication(stageId, destination, targets) {
    const unique=[...new Map(targets.map(target=>[target.id,target])).values()]
    const ids=JSON.stringify(unique.map(target=>target.id)), present=JSON.stringify(unique.filter(target=>target.present).map(target=>target.id))
    return {
      protect:[query('INSERT INTO form_import_native_publication_fences(stage_id,target_id) SELECT ?,value FROM json_each(?)',stageId,ids),query('INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN (SELECT count(*) FROM form_import_native_publication_fences WHERE stage_id=?)=json_array_length(?) AND NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(SELECT 1 FROM form_import_native_publication_fences f WHERE f.stage_id=? AND f.target_id=e.value)) THEN 1 ELSE 0 END',stageId,ids,ids,stageId)],
      seal:[query('UPDATE form_import_native_epochs SET seal=? WHERE target_id IN (SELECT value FROM json_each(?))',stageId,present)],
      release:[query('DELETE FROM form_import_native_publication_fences WHERE stage_id=?',stageId)],
      final:[query('NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(SELECT 1 FROM form_import_native_epochs r WHERE r.target_id=e.value AND r.seal=?))',present,stageId),...unique.filter(target=>!target.present).flatMap(target=>nativePredicates(null,destination,target.kind,target.id)),query('NOT EXISTS(SELECT 1 FROM form_import_native_publication_fences WHERE stage_id=?)',stageId)],
    }
  },
  matches(row, destination, kind, id) {
    const parts = nativePredicates(row, destination, kind, id)
    return query(parts.map(p => `(${p.sql})`).join(' AND '), ...parts.flatMap(p => p.params ?? []))
  },
  matchesParts: nativePredicates,
  write(row) {
    const value = row.value as unknown as NativeValue
    const statements: D1Sql[] = []
    for (const name of tableNames(row.targetKind)) {
      const columns = tables[name].columns
      const rows = value.tables[name] ?? []
      for (const chunk of nativeRowChunks(rows)) statements.push(retainedSql([`INSERT INTO ${name} (${columns.join(',')}) SELECT ${columns.map(c => `json_extract(value,'$.${c}')`).join(',')} FROM json_each(`, ...name === 'flows' ? [') WHERE (SELECT count(*) FROM flows WHERE workspace_id = ', ') < ', ''] : [')']], [chunk, ...name === 'flows' ? [row.destination, manifest.limits.flows.total] : []], [0]))
    }
    statements.push(query('INSERT INTO form_import_targets(target_id,workspace_id,kind,revision,flow_id) VALUES(?,?,?,?,?)', row.targetId, row.destination, row.targetKind, row.revision, value.flowId))
    return statements
  },
  remove(destination, kind, id) {
    return [...tableNames(kind).reverse().map(name => query(`DELETE FROM ${name} WHERE ${tables[name].scope}`, id)), query('DELETE FROM form_import_targets WHERE target_id = ? AND workspace_id = ? AND kind = ?', id, destination, kind)]
  },
  async list(db, destination) {
    // Set reads: one query per native table, independent of response count.
    const metadata = (await db.prepare('SELECT target_id,kind,revision,flow_id,committed_at FROM form_import_targets WHERE workspace_id = ? ORDER BY target_id').bind(destination).all<{ target_id: string; kind: string; revision: string; flow_id: string; committed_at: string }>()).results
    const all: Record<string, NativeRow[]> = {}
    for (const name of Object.keys(tables) as (keyof typeof tables)[]) all[name] = nativeSnapshotRows(name, (await db.prepare(`SELECT ${tables[name].columns.join(',')} FROM ${name} ORDER BY ${name === 'submission_tags' ? 'response_id,tag' : tables[name].columns[0]}`).all<NativeRow>()).results)
    return metadata.map(m => {
      const revisions = new Set(all.flow_revisions.filter(r => r.flow_id === m.flow_id).map(r => r.id)), steps = new Set(all.flow_steps.filter(r => revisions.has(r.revision_id)).map(r => r.id))
      const selected: NativeValue = { flowId: m.flow_id, tables: {} }
      for (const name of tableNames(m.kind)) selected.tables[name] = all[name].filter(r => name === 'flows' ? r.id === m.target_id : name === 'responses' ? r.id === m.target_id : ['response_answers', 'response_outbox', 'notification_deliveries', 'submission_workflows', 'submission_tags', 'submission_notes'].includes(name) ? r.response_id === m.target_id : name === 'notification_attempts' ? all.notification_deliveries.some(d => d.id === r.delivery_id && d.response_id === m.target_id) : name === 'flow_revisions' || name === 'form_import_revisions' || name === 'notification_preferences' || name === 'submission_statuses' ? r.flow_id === m.flow_id : name === 'choice_options' ? steps.has(r.step_id) : revisions.has(r.revision_id))
      for (const name of tableNames(m.kind)) if (optionalNativeTables.has(name) && !selected.tables[name].length) delete selected.tables[name]
      return { destination, targetKind: m.kind, targetId: m.target_id, revision: m.revision, value: selected as unknown as Json, committedAt: m.committed_at } as ImportTargetRow
    })
  },
  matchesCount(count, destination) { return query('(SELECT COUNT(*) FROM form_import_targets WHERE workspace_id = ?) = ?', destination, count) },
}

/** The product's destructive audit shares the kit's native reversal transaction. */
export function importTargetsFor(operatorId: string): D1TargetAdapter {
  return { ...importTargets, remove(destination, kind, id) {
    return [...importTargets.remove(destination, kind, id), query(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) VALUES(?,?,'import.reversed',?,?,NULL,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, crypto.randomUUID(), destination, operatorId, kind === 'form' ? 'flow' : 'response', JSON.stringify({ feature: 'form-import', outcome: 'removed-unedited-import' }))]
  } }
}
