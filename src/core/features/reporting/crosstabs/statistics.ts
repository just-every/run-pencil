import type { ChiSquare, DimensionOption } from './model'
const expectedCondition = 'Every expected cell count must be at least 5.'

export function chiSquare(row: DimensionOption, column: DimensionOption, counts:number[][],rowTotals:number[],columnTotals:number[],paired:number,suppressed:boolean): ChiSquare {
  const hidden = (reason:string):ChiSquare=>({eligible:false,statistic:null,df:null,minimumExpected:null,reason,expectedCondition})
  if (suppressed) return hidden('Withheld because one or more cells are suppressed.')
  if (row.multiple || column.multiple) return hidden('Multiple-select dimensions do not form independent single-answer categories.')
  const df=(rowTotals.length-1)*(columnTotals.length-1)
  if (!paired || df<1) return {...hidden('At least two populated categories in each dimension and paired responses are required.'),df:Math.max(0,df),minimumExpected:0}
  let statistic=0,minimumExpected=Infinity
  for (let r=0;r<rowTotals.length;r++) for (let c=0;c<columnTotals.length;c++) {
    const expected=rowTotals[r]*columnTotals[c]/paired
    minimumExpected=Math.min(minimumExpected,expected)
    if (expected>0) statistic+=(counts[r][c]-expected)**2/expected
  }
  if (minimumExpected===0) return {eligible:false,statistic:null,df,minimumExpected,reason:'An empty category has an expected cell count of zero.',expectedCondition}
  const eligible=minimumExpected>=5
  return {eligible,statistic,df,minimumExpected,reason:eligible?'The single-answer table meets the expected-count condition.':'At least one expected cell count is below 5.',expectedCondition}
}
