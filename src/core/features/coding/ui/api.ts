import type { LedgerFilter } from '../../../app/api'
export type Code = {id:string;label:string}
export type Assignment = {id:string;codeId:string;label:string;source:'manual'|'ai_suggestion';actorOperatorId:string;createdAt:string;quoteId:string|null}
export type CodedAnswer = {answerId:string;responseId:string;questionId:string;revisionId:string;prompt:string;text:string;assignments:Assignment[]}
export type Suggestion = {id:string;runId:string;responseId:string;questionId:string;prompt:string;suggestedLabel:string;start:number;end:number;excerpt:string;decision:null|{decision:'accepted'|'rejected';actorOperatorId:string;decidedAt:string;codeId:string|null}}
export type Counts = {responseDenominator:number;answerDenominator:number;codes:Array<Code & {answerCount:number;responseCount:number}>;nextAfter:string|null}
export type Cross = {rowCode:Code;columnCode:Code;responseDenominator:number;cells:Array<{rowPresent:boolean;columnPresent:boolean;count:number}>}
export async function codingRequest<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T> {
  const response=await fetch('/api/app/'+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  if(!response.ok) { const result=await response.json().catch(()=>null) as {error?:{message?:string}}|null;throw new Error(result?.error?.message ?? 'Coding could not be saved or loaded. Please refresh and try again.') }
  return response.status===204?undefined as T:await response.json() as T
}
export function codingQuery(filter:LedgerFilter,extra:Record<string,string|undefined>={}) {
  return new URLSearchParams(Object.entries({...filter,offset:undefined,...extra}).filter((pair):pair is [string,string]=>pair[1]!==undefined).map(([key,value])=>[key,String(value)])).toString()
}
