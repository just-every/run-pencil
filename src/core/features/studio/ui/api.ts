import type { StudioDraft,StudioInput,Study } from '../model'
import type { ProviderStatus } from '../../analysis'
async function request<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
  const response=await fetch(path,{method,credentials:'same-origin',...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})})
  const data=await response.json() as T & {message?:string}
  if(!response.ok)throw new Error(data.message ?? 'The studio request could not finish.')
  return data
}
export const studioApi={options:()=>request<{provider:ProviderStatus;forms:Array<{id:string;title:string;studio:boolean}>}>('/api/app/studio'),get:(id:string)=>request<StudioDraft>(`/api/app/studio/${encodeURIComponent(id)}`),generate:(input:StudioInput)=>request<StudioDraft>('/api/app/studio',input),save:(draft:StudioDraft,study:Study)=>request<StudioDraft>(`/api/app/studio/${encodeURIComponent(draft.flowId)}`,{expectedVersion:draft.version,study},'PUT')}
