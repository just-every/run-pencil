import { useEffect, useRef } from 'react'

type ViewInput = {slug:string;revisionId:string;source:'direct'|'embed';collectorKey?:string;invitationToken?:string;accessToken?:string}

/** One anonymous count and signed load timestamp per mounted form document. */
export function useViewCounter(input:ViewInput,enabled:boolean,resumedLoadTime?:string) {
  const pending = useRef<Promise<string> | undefined>(undefined)
  const key = JSON.stringify(input)
  const counted = useRef<string | undefined>(undefined)
  useEffect(()=>{
    if(resumedLoadTime) { pending.current=Promise.resolve(resumedLoadTime); return }
    if(!enabled || counted.current===key)return
    counted.current=key
    const {slug,...body}=input
    pending.current=fetch(`/api/public/flows/${encodeURIComponent(slug)}/views`,{
      method:'POST',credentials:'omit',headers:{'content-type':'application/json'},body:JSON.stringify(body),
    }).then(async response=>{
      if(!response.ok)throw new Error('The form load could not be confirmed. Reload the form before submitting.')
      const value=await response.json() as {loadTime?:string}
      if(!value.loadTime)throw new Error('The form load timestamp is missing. Reload the form before submitting.')
      return value.loadTime
    })
    // Keep the failure for a visible final-submit error, without an unhandled rejection.
    void pending.current.catch(()=>{})
  },[key,enabled,resumedLoadTime])
  return {token:async()=>{
    if(!pending.current)throw new Error('The form load could not be confirmed. Reload the form before submitting.')
    return pending.current
  }}
}
