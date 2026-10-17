import { defaultPolicies } from '../../analysis'
import { checkGeneration, generation } from '../cursor'
import { ValidationError } from '../../../shared/errors'
import { crosstabInputSchema, dimensionKey, type CrossTabInput, type CrossTabReport } from './model'
import { loadOptions } from './options'
import { aggregateCrossTab } from './query'
import { disclose } from './disclosure'
import { chiSquare } from './statistics'

export async function crossTab(db:D1Database,workspaceId:string,flowId:string,input:CrossTabInput):Promise<CrossTabReport> {
  const parsed=crosstabInputSchema.safeParse(input)
  if (!parsed.success) throw new ValidationError('Choose valid published categorical dimensions and ledger filters.')
  input=parsed.data
  if (dimensionKey(input.row)===dimensionKey(input.column)) throw new ValidationError('Choose two different dimensions for a crosstab.')
  if (input.filter?.revisionId && input.filter.revisionId!==input.revisionId) throw new ValidationError('The ledger filter and crosstab must use the same published revision.')
  const cutoff=new Date(input.cutoff??Date.now()).toISOString()
  const {result,questions,choices}=await loadOptions(db,workspaceId,flowId,input.revisionId)
  const scope={workspaceId,flowId,cutoff,sessionId:'',generation:await generation(db,workspaceId)}
  if (result.revision.publishedAt>cutoff) throw new ValidationError('Choose an evidence cutoff after this revision was published.')
  const row=result.dimensions.find(option=>dimensionKey(option.dimension)===dimensionKey(input.row))
  const column=result.dimensions.find(option=>dimensionKey(option.dimension)===dimensionKey(input.column))
  if (!row||!column) throw new ValidationError('Choose categorical questions or the collector from this published revision. Text, number, date, priority and unsupported dimensions cannot be crossed.')
  const aggregated=await aggregateCrossTab(db,workspaceId,flowId,input,cutoff,row,column,questions,choices)
  const stats=aggregated.find(value=>value.kind==='stats')!
  if (stats.invalid) throw new ValidationError('Invalid retained answer or collector attribution. This crosstab cannot be reported faithfully.')
  const rowIndex=new Map(row.buckets.map((bucket,index)=>[bucket.key,index]))
  const columnIndex=new Map(column.buckets.map((bucket,index)=>[bucket.key,index]))
  const counts=row.buckets.map(()=>column.buckets.map(()=>0)),rowTotals=row.buckets.map(()=>0),columnTotals=column.buckets.map(()=>0)
  for (const record of aggregated.filter(value=>value.kind!=='stats')) {
    const r=record.rowKey===null?undefined:rowIndex.get(record.rowKey),c=record.columnKey===null?undefined:columnIndex.get(record.columnKey)
    if (record.kind==='cell' && r!==undefined && c!==undefined) counts[r][c]=record.count
    else if (record.kind==='row' && r!==undefined) rowTotals[r]=record.count
    else if (record.kind==='column' && c!==undefined) columnTotals[c]=record.count
    else throw new ValidationError('A retained dimension value is not in its published category inventory.')
  }
  const disclosed=disclose(row,column,counts,rowTotals,columnTotals,result.disclosureThreshold)
  const [,currentPolicy]=await Promise.all([checkGeneration(db,scope),db.prepare('SELECT disclosure_threshold AS threshold FROM analysis_policies WHERE workspace_id=?').bind(workspaceId).first<{threshold:number}>()])
  if ((currentPolicy?.threshold??defaultPolicies.disclosureThreshold)!==result.disclosureThreshold) throw new ValidationError('The disclosure policy changed during this report. Refresh and try again.')
  const {dimensions:_dimensions,...metadata}=result
  return {...metadata,cutoff,filter:{...input.filter,revisionId:input.revisionId},row,column,rows:disclosed.rows,columns:disclosed.columns,cells:disclosed.cells,
    totalRespondents:disclosed.suppressed?null:stats.total!,pairedRespondents:disclosed.suppressed?null:stats.count,
    unpairedRespondents:disclosed.suppressed?null:stats.total!-stats.count,
    percentages:'Row percentages divide each cell by paired respondents selecting that row category; column percentages divide by paired respondents selecting that column category. Multiple-select shares may total more than 100%. Unanswered dimensions are excluded from paired denominators.',
    disclosure:{suppressed:disclosed.suppressed,threshold:result.disclosureThreshold,note:disclosed.suppressed?'Positive cells below the workspace disclosure threshold are withheld. Their row and column denominators and percentages, all response totals, and chi-square statistics are also withheld to prevent reconstruction.':'No positive cell is below the workspace disclosure threshold. Empty categories remain visible as zero.'},
    chiSquare:chiSquare(row,column,counts,rowTotals,columnTotals,stats.count,disclosed.suppressed),
  }
}
