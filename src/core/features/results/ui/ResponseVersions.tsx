import './response-versions.css'
import { useEffect, useState } from 'react'
type Version={number:number;current:boolean;createdAt:string;displayAnswers:Array<{stepId:string;value:unknown;label:string;displayValue:string}>}
export function ResponseVersions({responseId,time}:{responseId:string;time:(value:string)=>string}) {
  const [versions,setVersions]=useState<Version[]>(),[error,setError]=useState<string>()
  const [downloadError,setDownloadError]=useState<string>(),[downloading,setDownloading]=useState(false)
  useEffect(()=>{let active=true;void fetch(`/api/app/responses/${responseId}/versions`).then(async response=>{if(!response.ok)throw new Error();return response.json() as Promise<{versions:Version[]}>}).then(value=>{if(active)setVersions(value.versions)}).catch(()=>{if(active)setError('Version history could not load.')});return()=>{active=false}},[responseId])
  async function download() {
    setDownloading(true);setDownloadError(undefined)
    try {
      const response=await fetch(`/api/app/responses/${encodeURIComponent(responseId)}/versions/download`)
      if(!response.ok){setDownloadError(response.status===404?'This response is no longer available.':response.status===401?'Sign in again to download.':'Version history could not be downloaded. Try again.');return}
      const url=URL.createObjectURL(await response.blob())
      const link=document.createElement('a');link.href=url;link.download=`pencil-response-${responseId}-versions.jsonl`
      link.click();URL.revokeObjectURL(url)
    } catch {setDownloadError('Version history could not be downloaded. Check the connection and try again.')}
    finally {setDownloading(false)}
  }
  if(error)return <p role="alert">{error}</p>
  if(!versions?.length)return null
  return <details className="response-versions"><summary className="focus-ring">Response versions ({versions.length})</summary>
    <button className="quiet-button focus-ring" type="button" disabled={downloading} onClick={()=>void download()}>Download version history</button>
    {downloadError?<div role="alert">{downloadError} <button className="quiet-button focus-ring" type="button" disabled={downloading} onClick={()=>void download()}>Retry</button></div>:null}
    {versions.map(version=><section key={version.number} aria-label={`Version ${version.number}${version.current?' current':''}`}><h3>Version {version.number}{version.current?' · Current':''}</h3><p>{time(version.createdAt)}</p><dl>{version.displayAnswers.map(answer=><div className="ledger-answer" key={answer.stepId}><dt><strong>{answer.label}</strong></dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{answer.displayValue}</dd></div>)}</dl></section>)}
  </details>
}
