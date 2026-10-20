import { NotFoundError, ValidationError } from '../../shared/errors'
import { disclosureThreshold } from '../analysis'
import { ReportingRepository, type LedgerFilter } from './repository'
import { responseScope } from './scope'
import { dimensionCategories, resolveDimension, type Dimension } from './crosstabDimensions'
import { crosstabTable, type CrosstabCategory } from './crosstabStats'

export type CrosstabRequest = { workspaceId: string; flowId: string; revisionId: string; rows: string; columns: string; filter: LedgerFilter }
const unanswered: CrosstabCategory = { key: '', label: 'Unanswered', unanswered: true }
const describe = (dimension: Dimension) => ({ key: dimension.key, kind: dimension.kind, label: dimension.label, questionType: dimension.questionType, multipleSelect: dimension.multipleSelect, note: dimension.note })

/**
 * Crosses two dimensions over the released responses of one revision (RSLT-005) under the
 * LEDG-003 filter and an evidence cutoff. Every count is distinct responses; one batch reads one snapshot.
 */
export async function crosstab(db: D1Database, input: CrosstabRequest) {
  const reporting = new ReportingRepository(db)
  if (!await reporting.flow(input.workspaceId, input.flowId)) throw new NotFoundError('This flow is not available in your workspace.')
  const revision = (await reporting.revisions(input.flowId)).find(item => item.id === input.revisionId)
  if (!revision) throw new NotFoundError('This published revision is not part of the selected flow.')
  if (input.filter.revisionId && input.filter.revisionId !== input.revisionId) throw new ValidationError('A crosstab reads one revision. Choose the same revision in the filter.')
  if (input.rows === input.columns) throw new ValidationError('Choose two different dimensions to cross.')
  const [rows, columns] = await Promise.all([resolveDimension(db, input.flowId, input.revisionId, input.rows), resolveDimension(db, input.flowId, input.revisionId, input.columns)])
  const cutoff = new Date().toISOString()
  const filter = { ...input.filter, revisionId: input.revisionId, offset: undefined }
  const scope = responseScope(input.workspaceId, input.flowId, filter, cutoff, 'released')
  const cte = `WITH scoped AS (SELECT r.id AS rid, r.response_context_json AS ctx FROM responses r WHERE ${scope.where}), a AS (${rows.valueSql}), b AS (${columns.valueSql})`
  const bindings = [...scope.bindings, ...rows.bindings, ...columns.bindings]
  const statement = (sql: string) => db.prepare(`${cte} ${sql}`).bind(...bindings)
  const [cellRows, rowRows, columnRows, totalRows] = await db.batch([
    statement('SELECT a.v AS row, b.v AS column, COUNT(DISTINCT a.rid) AS n FROM a JOIN b ON b.rid = a.rid GROUP BY a.v, b.v'),
    statement('SELECT v, COUNT(DISTINCT rid) AS n FROM a GROUP BY v'),
    statement('SELECT v, COUNT(DISTINCT rid) AS n FROM b GROUP BY v'),
    statement('SELECT COUNT(*) AS n FROM scoped'),
  ])
  const totalsOf = (result: D1Result) => new Map((result.results as Array<{ v: string | null; n: number }>).map(row => [row.v ?? '', row.n]))
  const rowTotals = totalsOf(rowRows), columnTotals = totalsOf(columnRows)
  const categoriesOf = (dimension: Dimension, totals: Map<string, number>) => {
    const categories = dimensionCategories(dimension, [...totals.keys()].filter(key => key !== ''))
    return totals.get('') ? [...categories, unanswered] : categories
  }
  const rowCategories = categoriesOf(rows, rowTotals), columnCategories = categoriesOf(columns, columnTotals)
  const cellCounts = new Map((cellRows.results as Array<{ row: string | null; column: string | null; n: number }>).map(cell => [`${cell.row ?? ''}\0${cell.column ?? ''}`, cell.n]))
  const table = crosstabTable({
    rows: rowCategories, columns: columnCategories,
    cells: rowCategories.map(row => columnCategories.map(column => cellCounts.get(`${row.key}\0${column.key}`) ?? 0)),
    rowTotals: rowCategories.map(row => rowTotals.get(row.key) ?? 0),
    columnTotals: columnCategories.map(column => columnTotals.get(column.key) ?? 0),
    total: (totalRows.results[0] as { n: number }).n,
  }, await disclosureThreshold(db, input.workspaceId), rows.multipleSelect || columns.multipleSelect)
  const notes = [...table.notes]
  for (const [side, dimension, totals] of [['Rows', rows, rowTotals], ['Columns', columns, columnTotals]] as const) {
    if (!totals.get('')) notes.push(`${side} (${dimension.label}): Unanswered — none in this selection.`)
    if (dimension.note) notes.push(`${side} (${dimension.label}): ${dimension.note}`)
  }
  return { revision: { id: revision.id, number: revision.number }, cutoff, filter, policy: 'analysis.disclosure.v1' as const, rowDimension: describe(rows), columnDimension: describe(columns), ...table, notes }
}
export type Crosstab = Awaited<ReturnType<typeof crosstab>>
