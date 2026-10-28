import { ValidationError } from '../../shared/errors'
import { dimensionCategories } from './crosstabDimensions'
import { resolveSharedDimension } from './sharedDimensions'
import { crosstabTable } from './crosstabStats'
import { responseScope } from './scope'
import type { SharedCrosstabTable, SharedCrosstabDimension } from './savedModel'
import type { CrosstabRequest } from './crosstab'

/** Code presence and ordinary dimensions use the same distinct-response incidences. */
export async function sharedCodeCrosstab(db: D1Database, input: CrosstabRequest & { cutoff: string; thresholdFloor: number }): Promise<SharedCrosstabTable> {
  if (input.rows === input.columns) throw new ValidationError('Choose two different dimensions to cross.')
  const revision = await db.prepare("SELECT number FROM flow_revisions WHERE id=? AND flow_id=? AND state='published'").bind(input.revisionId, input.flowId).first<{ number: number }>()
  if (!revision) throw new ValidationError('Choose a published revision for this crosstab.')
  const [rows, columns] = await Promise.all([input.rows, input.columns].map(key => resolveSharedDimension(db, input.workspaceId, input.flowId, input.revisionId, key, input.cutoff)))
  const filter = { ...input.filter, revisionId: input.revisionId, offset: undefined }
  const scope = responseScope(input.workspaceId, input.flowId, filter, input.cutoff)
  const cte = `WITH scoped AS (SELECT r.id AS rid,r.response_context_json AS ctx FROM responses r WHERE ${scope.where}),a AS (${rows.valueSql}),b AS (${columns.valueSql})`
  const bindings = [...scope.bindings, ...rows.bindings, ...columns.bindings]
  const statement = (sql: string) => db.prepare(`${cte} ${sql}`).bind(...bindings)
  const [cells, rowResult, columnResult, total] = await db.batch([
    statement('SELECT a.v AS row,b.v AS column,COUNT(DISTINCT a.rid) AS n FROM a JOIN b ON b.rid=a.rid GROUP BY a.v,b.v'),
    statement('SELECT v,COUNT(DISTINCT rid) AS n FROM a GROUP BY v'),
    statement('SELECT v,COUNT(DISTINCT rid) AS n FROM b GROUP BY v'),
    statement('SELECT COUNT(*) AS n FROM scoped'),
  ])
  const totals = (result: D1Result) => new Map((result.results as Array<{ v: string | null; n: number }>).map(row => [row.v ?? '', row.n]))
  const rowTotals = totals(rowResult), columnTotals = totals(columnResult)
  const categories = (dimension: typeof rows, counts: Map<string, number>) => {
    const fixed = dimension.kind === 'code' ? dimension.categories! : dimensionCategories({ ...dimension, kind: dimension.kind }, [...counts.keys()].filter(key => key !== ''))
    return counts.get('') ? [...fixed, { key: '', label: 'Unanswered', unanswered: true }] : fixed
  }
  const rowCategories = categories(rows, rowTotals), columnCategories = categories(columns, columnTotals)
  const counts = new Map((cells.results as Array<{ row: string | null; column: string | null; n: number }>).map(cell => [`${cell.row ?? ''}\0${cell.column ?? ''}`, cell.n]))
  const table = crosstabTable({ rows: rowCategories, columns: columnCategories,
    cells: rowCategories.map(row => columnCategories.map(column => counts.get(`${row.key}\0${column.key}`) ?? 0)),
    rowTotals: rowCategories.map(row => rowTotals.get(row.key) ?? 0), columnTotals: columnCategories.map(column => columnTotals.get(column.key) ?? 0),
    total: (total.results[0] as { n: number }).n,
  }, input.thresholdFloor, rows.multipleSelect || columns.multipleSelect)
  const describe = (dimension: typeof rows): SharedCrosstabDimension => ({ key: dimension.key, kind: dimension.kind, label: dimension.label, questionType: dimension.questionType, multipleSelect: dimension.multipleSelect, note: dimension.note })
  return { ...table, revision: { id: input.revisionId, number: revision.number }, cutoff: input.cutoff, filter, policy: 'analysis.disclosure.v1', rowDimension: describe(rows), columnDimension: describe(columns) }
}
