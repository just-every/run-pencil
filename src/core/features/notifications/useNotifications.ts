import { useCallback, useEffect, useRef, useState } from 'react'
import { keepIfSame, useQuietRefresh } from '../../shared/ui/useQuietRefresh'
import type { NotificationMode, NotificationState } from './repository'
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path,{method,headers:body === undefined ? undefined : {'content-type':'application/json'},body:body === undefined ? undefined : JSON.stringify(body)})
  const data = response.status === 204 ? undefined : await response.json()
  if (!response.ok) throw new Error((data as {message?:string} | undefined)?.message ?? (response.status === 401 ? 'Sign in to manage notifications.' : 'The notification request failed.'))
  return data as T
}
export const notificationApi = {
  read: (flowId: string) => request<NotificationState>(`/api/app/flows/${encodeURIComponent(flowId)}/notifications`),
  set: (flowId: string, mode: NotificationMode) => request<NotificationState>(`/api/app/flows/${encodeURIComponent(flowId)}/notifications`,'PUT',{mode}),
  retry: (id: string, duplicateRiskAccepted: boolean) => request<void>(`/api/app/notifications/${encodeURIComponent(id)}/retry`,'POST',{duplicateRiskAccepted}),
}
export function useNotifications(flowId: string) {
  const [state,setState] = useState<NotificationState>(), [error,setError] = useState<string>(), [busy,setBusy] = useState(false), [notice,setNotice] = useState<string>()
  const generation = useRef(0), currentFlow = useRef(flowId)
  currentFlow.current = flowId
  const refresh = useCallback(async () => { if(currentFlow.current!==flowId) return; const current=++generation.current; const next=await notificationApi.read(flowId); if (generation.current===current && currentFlow.current===flowId) setState(previous => previous ? keepIfSame(previous,next) : next) },[flowId])
  useEffect(() => { let active=true; setState(undefined); setError(undefined); setNotice(undefined); setBusy(false); void refresh().catch(e=>{if(active) setError((e as Error).message)}); return () => { active=false; generation.current++ } },[refresh])
  useQuietRefresh(refresh)
  const act = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);setError(undefined);setNotice(undefined)
    try { await action(); await refresh(); if(currentFlow.current===flowId) setNotice(message) } catch(e) { if(currentFlow.current===flowId) setError((e as Error).message) } finally { if(currentFlow.current===flowId) setBusy(false) }
  }
  return {state,error,busy,notice,setMode:(mode:NotificationMode)=>act(()=>notificationApi.set(flowId,mode),'Your notification preference is saved.'),retry:(id:string,accepted:boolean)=>act(()=>notificationApi.retry(id,accepted),'Retry queued with the original delivery key.')}
}
