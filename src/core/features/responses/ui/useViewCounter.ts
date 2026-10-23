import { useEffect, useRef } from 'react'

type ViewInput = {slug:string;revisionId:string;source:'direct'|'embed';collectorKey?:string;invitationToken?:string;accessToken?:string}

/** Email answer landings defer counting until the respondent interacts. */
export function useViewCounter(input:ViewInput,enabled:boolean,resumedLoadTime?:string) {
  const pending = useRef<Promise<string> | undefined>(undefined)
  const key = JSON.stringify(input)
  const counted = useRef<string | undefined>(undefined)
  const begin=()=>{
    if(resumedLoadTime) { pending.current=Promise.resolve(resumedLoadTime); return pending.current }
    if(counted.current===key && pending.current)return pending.current
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
    void pending.current.catch(()=>{})
    return pending.current
  }
  useEffect(()=>{if(enabled||resumedLoadTime)void begin()},[key,enabled,resumedLoadTime])
  return {begin,token:()=>begin()}
}
