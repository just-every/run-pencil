import { useEffect, useState } from 'react'
type Version={number:number;current:boolean;createdAt:string;displayAnswers:Array<{stepId:string;value:unknown;label:string;displayValue:string}>}
export function ResponseVersions({responseId}:{responseId:string}) {
 const [versions,setVersions]=useState<Version[]>(),[error,setError]=useState<string>()
 useEffect(()=>{let active=true;void fetch(`/api/app/responses/${responseId}/versions`).then(async response=>{if(!response.ok)throw new Error('Version history could not load.');return response.json() as Promise<{versions:Version[]}>}).then(value=>{if(active)setVersions(value.versions)}).catch(reason=>{if(active)setError((reason as Error).message)});return()=>{active=false}},[responseId])
 if(error)return <p role="alert">{error}</p>
 if(!versions?.length)return null
 return <details><summary className="focus-ring">Response versions ({versions.length})</summary>{versions.map(version=><section key={version.number} aria-label={`Version ${version.number}${version.current?' current':''}`}><h3>Version {version.number}{version.current?' · Current':''}</h3><p>{new Date(version.createdAt).toLocaleString()}</p><dl>{version.displayAnswers.map(answer=><div className="ledger-answer" key={answer.stepId}><dt>{answer.label}</dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{answer.displayValue}</dd></div>)}</dl></section>)}</details>
}
