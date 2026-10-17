import type { CrossTabCell, DimensionOption, Margin } from './model'

/** Hide every margin/percentage that could directly reconstruct a small cell. */
export function disclose(row:DimensionOption,column:DimensionOption,counts:number[][],rowTotals:number[],columnTotals:number[],threshold:number) {
  const small=counts.map(values=>values.map(value=>value>0&&value<threshold))
  const hiddenRows=small.map(values=>values.some(Boolean))
  const hiddenColumns=column.buckets.map((_,c)=>small.some(values=>values[c]))
  const rows:Margin[]=row.buckets.map((bucket,r)=>({...bucket,pairedRespondents:hiddenRows[r]?null:rowTotals[r],suppressed:hiddenRows[r]}))
  const columns:Margin[]=column.buckets.map((bucket,c)=>({...bucket,pairedRespondents:hiddenColumns[c]?null:columnTotals[c],suppressed:hiddenColumns[c]}))
  const cells:CrossTabCell[]=row.buckets.flatMap((bucket,r)=>column.buckets.map((other,c)=>({
    rowKey:bucket.key,columnKey:other.key,count:small[r][c]?null:counts[r][c],suppressed:small[r][c],
    rowPercent:hiddenRows[r]||!rowTotals[r]?null:counts[r][c]/rowTotals[r]*100,
    columnPercent:hiddenColumns[c]||!columnTotals[c]?null:counts[r][c]/columnTotals[c]*100,
  })))
  return {rows,columns,cells,suppressed:hiddenRows.some(Boolean)}
}
