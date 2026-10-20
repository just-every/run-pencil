/** Pure crosstab statistics (RSLT-006): stated shares, ANLY-005 suppression and Pearson chi-square. */
export type CrosstabCategory = { key: string; label: string; unanswered?: boolean }
export type CrosstabShare = { numerator: number; denominator: number; percentage: number }
export type CrosstabCell = { suppressed: true } | { suppressed: false; count: number; rowShare: CrosstabShare | null; columnShare: CrosstabShare | null }
export type CrosstabTotal = { withheld: true } | { withheld: false; count: number }
export type ChiSquare =
  | { offered: false; reason: string }
  | { offered: true; withheld: true; reason: string }
  | { offered: true; withheld: false; statistic: number; degreesOfFreedom: number; pValue: number; minimumExpected: number; flagged: boolean; reason: string }
export type CrosstabCounts = { rows: CrosstabCategory[]; columns: CrosstabCategory[]; cells: number[][]; rowTotals: number[]; columnTotals: number[]; total: number }
export type CrosstabTable = { rows: CrosstabCategory[]; columns: CrosstabCategory[]; cells: CrosstabCell[][]; rowTotals: CrosstabTotal[]; columnTotals: CrosstabTotal[]; total: CrosstabTotal; suppressedCells: number; threshold: number; chiSquare: ChiSquare; notes: string[] }

const share = (numerator: number, denominator: number): CrosstabShare | null => denominator > 0 ? { numerator, denominator, percentage: numerator / denominator * 100 } : null

/**
 * A cell with fewer responses than the threshold (exactly the threshold is shown) is suppressed.
 * The row total, column total and grand total that would let a reader subtract it back, every
 * share divided by a withheld total, and the chi-square are withheld (ct pattern 4).
 */
export function crosstabTable(counts: CrosstabCounts, threshold: number, multipleSelect: boolean): CrosstabTable {
  const suppressed = counts.cells.map(row => row.map(count => count < threshold))
  const rowWithheld = suppressed.map(row => row.some(Boolean))
  const columnWithheld = counts.columns.map((_, j) => suppressed.some(row => row[j]))
  const suppressedCells = suppressed.flat().filter(Boolean).length
  const cells: CrosstabCell[][] = counts.cells.map((row, i) => row.map((count, j) => suppressed[i][j] ? { suppressed: true } : {
    suppressed: false, count,
    rowShare: rowWithheld[i] ? null : share(count, counts.rowTotals[i]),
    columnShare: columnWithheld[j] ? null : share(count, counts.columnTotals[j]),
  }))
  const total = (count: number, withheld: boolean): CrosstabTotal => withheld ? { withheld: true } : { withheld: false, count }
  const notes: string[] = []
  if (multipleSelect) notes.push('Multiple select: a response counts in each option it chose, so row or column shares may total more than 100%.')
  if (suppressedCells) notes.push(`${suppressedCells} ${suppressedCells === 1 ? 'cell has' : 'cells have'} fewer than ${threshold} responses and ${suppressedCells === 1 ? 'is' : 'are'} suppressed (ANLY-005). Totals, shares and chi-square that would reveal a suppressed cell within this table are withheld. This protects only the table: withheld figures can be derived from the answer summaries, response count, other results panels, ledger and exports, which stay complete for operators who may read this form’s responses. Pencil makes no non-reconstruction guarantee beyond this table.`)
  return {
    rows: counts.rows, columns: counts.columns, cells, threshold, suppressedCells, notes,
    rowTotals: counts.rowTotals.map((count, i) => total(count, rowWithheld[i])),
    columnTotals: counts.columnTotals.map((count, j) => total(count, columnWithheld[j])),
    total: total(counts.total, suppressedCells > 0),
    chiSquare: multipleSelect ? { offered: false, reason: 'Chi-square is not offered for a multiple-select crossing: one response can count in several cells, so cells are not independent.' }
      : suppressedCells ? { offered: true, withheld: true, reason: 'Chi-square is withheld because a suppressed cell could be recovered from it.' }
      : pearson(counts),
  }
}

/** Unanswered categories and empty rows or columns take no part in the test. */
export function pearson(counts: CrosstabCounts): ChiSquare {
  const rows = counts.rows.map((row, i) => i).filter(i => !counts.rows[i].unanswered)
  const columns = counts.columns.map((column, j) => j).filter(j => !counts.columns[j].unanswered)
  const rowSums = new Map(rows.map(i => [i, columns.reduce((sum, j) => sum + counts.cells[i][j], 0)]))
  const columnSums = new Map(columns.map(j => [j, rows.reduce((sum, i) => sum + counts.cells[i][j], 0)]))
  const usedRows = rows.filter(i => rowSums.get(i)! > 0), usedColumns = columns.filter(j => columnSums.get(j)! > 0)
  if (usedRows.length < 2 || usedColumns.length < 2) return { offered: false, reason: 'Chi-square needs at least two answered rows and two answered columns with responses.' }
  const n = usedRows.reduce((sum, i) => sum + rowSums.get(i)!, 0)
  let statistic = 0, minimumExpected = Infinity
  for (const i of usedRows) for (const j of usedColumns) {
    const expected = rowSums.get(i)! * columnSums.get(j)! / n
    minimumExpected = Math.min(minimumExpected, expected)
    statistic += (counts.cells[i][j] - expected) ** 2 / expected
  }
  const degreesOfFreedom = (usedRows.length - 1) * (usedColumns.length - 1)
  const flagged = minimumExpected >= 5
  return { offered: true, withheld: false, statistic, degreesOfFreedom, pValue: chiSquareSurvival(statistic, degreesOfFreedom), minimumExpected, flagged,
    reason: flagged ? `Every expected cell count is at least 5 (smallest ${minimumExpected.toFixed(2)}).` : `Not flagged: the smallest expected cell count is ${minimumExpected.toFixed(2)}, below 5, so the test is unreliable.` }
}

/** P(X ≥ statistic) for X ~ χ²(df): the regularized upper incomplete gamma Q(df/2, statistic/2). */
export function chiSquareSurvival(statistic: number, degreesOfFreedom: number) {
  const a = degreesOfFreedom / 2, x = statistic / 2
  if (x <= 0) return 1
  const front = Math.exp(-x + a * Math.log(x) - logGamma(a))
  if (x < a + 1) {
    let term = 1 / a, sum = term
    for (let n = 1; n < 1000 && Math.abs(term) > Math.abs(sum) * 1e-15; n++) { term *= x / (a + n); sum += term }
    return Math.max(0, 1 - sum * front)
  }
  // Lentz's continued fraction for Q(a, x).
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-15) break
  }
  return Math.min(1, front * h)
}

const lanczos = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  z -= 1
  let x = 0.99999999999980993
  for (const [i, coefficient] of lanczos.entries()) x += coefficient / (z + i + 1)
  const t = z + lanczos.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
