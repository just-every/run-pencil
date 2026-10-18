import { useEffect, useRef } from 'react'

/** One anonymous aggregate increment per actual mounted form document. */
export function useViewCounter(input:{slug:string;revisionId:string;source:'direct'|'embed';collectorKey?:string;invitationToken?:string},enabled:boolean) {
  const counted=useRef<string | undefined>(undefined)
  const key=JSON.stringify(input)
  useEffect(()=>{
    if(!enabled||counted.current===key)return
    counted.current=key
    const {slug,...body}=input
    void fetch(`/api/public/flows/${encodeURIComponent(slug)}/views`,{method:'POST',credentials:'omit',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      .then(response=>{if(!response.ok)throw new Error('The published view counter refused this request.')})
      .catch(error=>console.error('Pencil could not count this form view.',error))
  },[key,enabled])
}
