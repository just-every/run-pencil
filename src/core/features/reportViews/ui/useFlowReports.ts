import { useCallback, useEffect, useState } from 'react'
import { api, reportingApi, type Ledger } from '../../../app/api'
import type { ReportDashboard } from '..'
import { failureMessage, reportViewsApi } from './client'
export type FlowReportMetadata={title:string;timeZone:string;revisions:Ledger['revisions'];dashboard:ReportDashboard}
export function useFlowReports(flowId:string){
  const [data,setData]=useState<FlowReportMetadata>(),[error,setError]=useState<string>(),[version,setVersion]=useState(0)
  const reload=useCallback(()=>setVersion(value=>value+1),[])
  useEffect(()=>{
    let active=true;setData(undefined);setError(undefined)
    Promise.all([api.workspace(),reportingApi.ledger(flowId,{}),reportViewsApi.list(flowId)]).then(([workspace,ledger,dashboard])=>{
      if(active)setData({title:ledger.flow.title,timeZone:workspace.timeZone,revisions:ledger.revisions,dashboard})
    }).catch(error=>{if(active)setError(failureMessage(error))})
    return()=>{active=false}
  },[flowId,version])
  return {data,error,reload}
}
export function reportTime(value:string,timeZone:string){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone}).format(new Date(value))}
export function reportDay(value:string|undefined,timeZone:string){
  if(!value)return ''
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
