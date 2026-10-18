import { useEffect, useRef, useState } from 'react'
import type { PublicFlow } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'
import { RespondentFlowPage } from './RespondentFlowPage'

// A remount drops all answer, pending-submit, resume and session state. Browser
// history cannot restore that component: shared-device visits reload on pageshow.
export function KioskFlow({config,data,slug,idleSeconds,accessToken,verifiedIdentity,onResetAccess}:{config:PublicSeedConfig;data:{flow:PublicFlow;collectorKey?:string};slug:string;idleSeconds:number;accessToken?:string;verifiedIdentity?:string;onResetAccess?:()=>void}) {
  const [generation,setGeneration]=useState(0),[complete,setComplete]=useState(false)
  const current=useRef(0)
  const reset=()=>{if(onResetAccess){onResetAccess();return}current.current+=1;setGeneration(current.current);setComplete(false)}
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>
    const activity=()=>{clearTimeout(timer);timer=setTimeout(reset,idleSeconds*1000)}
    const restored=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload()}
    const hide=()=>{if(document.hidden)reset()}
    const events=['pointerdown','keydown','input','touchstart'] as const
    events.forEach(name=>window.addEventListener(name,activity,{passive:true}));window.addEventListener('pageshow',restored);document.addEventListener('visibilitychange',hide);activity()
    return()=>{clearTimeout(timer);events.forEach(name=>window.removeEventListener(name,activity));window.removeEventListener('pageshow',restored);document.removeEventListener('visibilitychange',hide)}
  },[idleSeconds,generation])
  useEffect(()=>{if(!complete)return;const timer=setTimeout(reset,2500);return()=>clearTimeout(timer)},[complete])
  if(complete)return <main className="pencil-canvas respondent-shell"><article className="respondent-card"><h1 className="display" tabIndex={-1} autoFocus>Thank you for your response.</h1><p role="status">Ready for the next person in a moment.</p><button className="primary-button focus-ring" onClick={reset}>Start next response</button></article></main>
  return <RespondentFlowPage key={generation} config={config} initialFlow={data.flow} slug={slug} collectorKey={data.collectorKey} accessToken={accessToken} verifiedIdentity={verifiedIdentity} onKioskComplete={()=>{if(current.current===generation)setComplete(true)}} />
}
