import type { CrossTabInput, CrossTabOptions, CrossTabReport } from '../../reporting/crosstabs'
import type { ReportDashboard, ReportView, ReportViewCreate } from '..'

async function request<T>(path:string,init:RequestInit={}):Promise<T> {
  const response=await fetch(path,{...init,credentials:'same-origin',headers:{Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}})
  if(response.status===204)return undefined as T
  let body:unknown
  try{body=await response.json()}catch{throw new Error('The server returned an unreadable response. Try again.')}
  if(!response.ok){
    const message=body&&typeof body==='object'&&'message' in body&&typeof body.message==='string'?body.message:`The request failed (${response.status}).`
    throw new Error(message)
  }
  return body as T
}
const root=(flowId:string)=>`/api/app/flows/${encodeURIComponent(flowId)}`
export const reportViewsApi={
  options:(flowId:string,revisionId:string,signal?:AbortSignal)=>request<CrossTabOptions>(`${root(flowId)}/crosstabs/options?revisionId=${encodeURIComponent(revisionId)}`,{signal}),
  crossTab:(flowId:string,input:CrossTabInput,signal?:AbortSignal)=>request<CrossTabReport>(`${root(flowId)}/crosstabs`,{method:'POST',body:JSON.stringify(input),signal}),
  list:(flowId:string)=>request<ReportDashboard>(`${root(flowId)}/report-views`),
  get:(flowId:string,viewId:string,signal?:AbortSignal)=>request<ReportView>(`${root(flowId)}/report-views/${encodeURIComponent(viewId)}`,{signal}),
  save:(flowId:string,input:ReportViewCreate)=>request<ReportView>(`${root(flowId)}/report-views`,{method:'POST',body:JSON.stringify(input)}),
  arrange:(flowId:string,version:number,viewIds:string[])=>request<ReportDashboard>(`${root(flowId)}/report-dashboard`,{method:'PUT',body:JSON.stringify({version,viewIds})}),
  erase:(flowId:string,viewId:string)=>request<void>(`${root(flowId)}/report-views/${encodeURIComponent(viewId)}`,{method:'DELETE',body:'{}'}),
}
export const failureMessage=(error:unknown)=>error instanceof Error?error.message:'The request could not be completed.'
