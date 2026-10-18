import { useEffect, useState } from 'react'
import { approvedOrigin } from '../../../shared/completionRedirect'

export function RedirectOriginsSettings({origins,disabled,onSave,onDirtyChange}:{origins:string[];disabled:boolean;onSave:(origins:string[])=>Promise<void>;onDirtyChange:(value:boolean)=>void}) {
  const [text,setText]=useState(origins.join('\n')), [error,setError]=useState('')
  const dirty=text!==origins.join('\n'), values=text.split('\n').map(line=>line.trim()).filter(Boolean)
  const valid=values.length<=20&&new Set(values).size===values.length&&values.every(approvedOrigin)
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false)},[dirty,onDirtyChange])
  return <details className="quiet-panel"><summary className="focus-ring">Approved redirect origins</summary><fieldset className="plain-fieldset" disabled={disabled}>
    <legend>Destinations allowed on the next publication</legend><p className="muted">One HTTPS origin per line, for example https://sales.example.com. Approving an origin lets this form send the explicitly mapped values there after submission. Published revisions keep their approved destinations until republished.</p>
    <label className="inspector-field">Approved HTTPS origins<textarea className="text-area" value={text} onChange={event=>{setText(event.target.value);setError('')}}/></label>
    {dirty&&!valid?<p role="alert">Use at most 20 distinct HTTPS origins without paths, fragments or credentials.</p>:null}
    {error?<p role="alert">{error}</p>:null}
    <button className="secondary-button focus-ring" type="button" disabled={!dirty||!valid} onClick={()=>void onSave(values).catch(reason=>setError(reason instanceof Error?reason.message:'Origins could not be saved.'))}>Save redirect origins</button>
  </fieldset></details>
}
