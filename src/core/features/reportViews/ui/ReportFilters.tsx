import { LedgerWorkflowFilters } from '../../submissions'
import { dayBoundary } from '../../../shared/timeZone'
import type { CrossTabOptions, CrossTabInput } from '../../reporting/crosstabs'
import { reportDay } from './useFlowReports'
import { failureMessage } from './client'
type Filter=NonNullable<CrossTabInput['filter']>
export function ReportFilters({flowId,value,options,timeZone,onChange,onError}:{flowId:string;value:Filter;options:CrossTabOptions;timeZone:string;onChange:(value:Filter)=>void;onError:(message:string)=>void}){
  const collectors=options.dimensions.find(option=>option.dimension.kind==='collector')!.buckets
  const day=(key:'from'|'to',valueDay:string)=>{try{onChange({...value,[key]:valueDay?dayBoundary(valueDay,timeZone,key==='to'):undefined})}catch(error){onError(failureMessage(error))}}
  return <details className="rv-filters-details"><summary>Filters</summary><div className="rv-filter-options">
    <label>Source<select value={value.source??''} onChange={event=>onChange({...value,source:event.target.value as Filter['source']||undefined})}><option value="">All sources</option><option value="direct">Direct link</option><option value="embed">Embed</option><option value="invitation">Invitation</option><option value="imported">Imported</option><option value="unknown">Historical source unavailable</option></select></label>
    <label>Collector<select value={value.collectorId??''} onChange={event=>onChange({...value,collectorId:event.target.value||undefined})}><option value="">All collectors</option>{collectors.map(collector=><option value={String(collector.value)} key={collector.key}>{collector.label}</option>)}</select></label>
    <label>Submitted from<input type="date" value={reportDay(value.from,timeZone)} onChange={event=>day('from',event.target.value)}/></label>
    <label>Submitted through<input type="date" value={reportDay(value.to,timeZone)} onChange={event=>day('to',event.target.value)}/></label>
    <p className="rv-zone">Dates use {timeZone}.</p>
    <label>Participant status<select value={value.participantStatus??''} onChange={event=>onChange({...value,participantStatus:event.target.value as Filter['participantStatus']||undefined})}><option value="">All participants and anonymous</option><option value="eligible">Eligible</option><option value="opted-out">Opted out</option><option value="bounced">Bounced</option></select></label>
    <LedgerWorkflowFilters flowId={flowId} value={value} onChange={next=>{const {offset:_offset,...filter}=next;onChange(filter)}}/>
    {value.answerStepId&&value.answerValue!==undefined?<div className="rv-retained-filter"><p>This saved view also has an answer filter. Running it keeps that filter.</p><button type="button" className="quiet-button focus-ring" onClick={()=>onChange({...value,answerStepId:undefined,answerValue:undefined})}>Clear answer filter</button></div>:null}
  </div></details>
}
export function FilterSummary({filter,options}:{filter:Filter;options:CrossTabOptions}){
  const source=filter.source?{direct:'Direct link',embed:'Embed',invitation:'Invitation',imported:'Imported',unknown:'Historical source unavailable'}[filter.source]:'All sources'
  const collector=filter.collectorId?options.dimensions.find(option=>option.dimension.kind==='collector')!.buckets.find(bucket=>bucket.value===filter.collectorId)?.label:'All collectors'
  const extra=Object.keys(filter).some(key=>!['source','collectorId','revisionId'].includes(key)&&filter[key as keyof Filter]!==undefined)
  return <p className="rv-filter-copy">{source} · {collector??'Selected collector'}{extra?' · More filters applied':''}</p>
}
