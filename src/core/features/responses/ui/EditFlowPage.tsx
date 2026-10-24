import { useEffect, useState } from 'react'
import type { PublicFlow } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'
import { RespondentFlowPage } from './RespondentFlowPage'
export function EditFlowPage({config,slug,token}:{config:PublicSeedConfig;slug:string;token:string}) {
 const [data,setData]=useState<{flow:PublicFlow;answers:Array<{stepId:string;value:unknown}>;deadline:string}>(),[error,setError]=useState<string>()
 useEffect(()=>{let active=true;void fetch(`/api/public/flows/${encodeURIComponent(slug)}/edit?token=${encodeURIComponent(token)}`,{cache:'no-store'}).then(async response=>{const value=await response.json() as {flow:PublicFlow;answers:Array<{stepId:string;value:unknown}>;deadline:string;message?:string};if(!response.ok)throw new Error(value.message??'This edit link is unavailable.');return value}).then(value=>{if(active)setData(value)}).catch(reason=>{if(active)setError((reason as Error).message)});return()=>{active=false}},[slug,token])
 if(data)return <><aside aria-label="Response editing" className="status-note" style={{margin:'1rem'}}>Editing your response · one submission before {new Date(data.deadline).toLocaleString()}</aside><RespondentFlowPage config={config} slug={slug} initialFlow={data.flow} restoredAnswers={data.answers} editToken={token}/></>
 return <main className="pencil-canvas respondent-shell"><article className="panel respondent-card" aria-busy={!error}><h1>Edit your response</h1>{error?<p role="alert">{error}</p>:<p>Loading your current answers…</p>}</article></main>
}
