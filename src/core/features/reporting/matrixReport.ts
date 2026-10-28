import { matrixRows, matrixMultiple, matrixAnswerIssue } from '../../shared/matrix'

export type MatrixRowSummary = {
  id: string; label: string; answered: number; multipleSelect: boolean
  distribution: Array<{ value: string; label: string; count: number }>
}
export type MatrixBucket = { stepId: string; rowId: string; value: string; count: number; answered: number }

export function matrixSummary(settings: Record<string, unknown>, choices: Array<{ id: string; label: string }>, buckets: MatrixBucket[]): MatrixRowSummary[] {
  return matrixRows(settings).map(row => {
    const entries = buckets.filter(bucket => bucket.rowId === row.id)
    return { ...row, answered: entries[0]?.answered ?? 0, multipleSelect: matrixMultiple(settings),
      distribution: choices.map(choice => ({ value: choice.id, label: choice.label, count: entries.find(bucket => bucket.value === choice.id)?.count ?? 0 })) }
  })
}

/** Used only by the in-memory composition helper; production reports aggregate in SQL. */
export function summarizeMatrixAnswers(settings: Record<string, unknown>, choices: Array<{ id: string; label: string }>, values: unknown[]): MatrixRowSummary[] {
  for (const value of values) if (matrixAnswerIssue(settings, choices.map(choice => choice.id), value, false)) throw new Error('Invalid stored matrix answer')
  return matrixRows(settings).map(row => {
    const answers = values.map(value => Object.hasOwn(value as object, row.id) ? (value as Record<string, string | string[]>)[row.id] : undefined).filter(value => value !== undefined)
    return { ...row, answered: answers.length, multipleSelect: matrixMultiple(settings),
      distribution: choices.map(choice => ({ value: choice.id, label: choice.label, count: answers.filter(value => Array.isArray(value) ? value.includes(choice.id) : value === choice.id).length })) }
  })
}
