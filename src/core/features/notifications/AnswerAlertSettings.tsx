import './answer-alerts.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, type BuilderDraft, type Operator } from '../../app/api'
import { answerAlertsIssue, paymentStateOperand, type AnswerAlertRule } from '../../shared/answerAlerts'
import { ConditionEditor, firstCondition } from '../flows/ui'
import { chatRequest, type ChatFormLink } from '../chat-integrations/ui'

type Props={draft:BuilderDraft;disabled:boolean;discardVersion:number;onDirtyChange:(dirty:boolean)=>void;onSave:(rules:AnswerAlertRule[],retry:boolean)=>Promise<'saved'|'conflict'>}
export function AnswerAlertSettings({draft,disabled,onSave,onDirtyChange,discardVersion}:Props) {
  const serverRules=JSON.stringify(draft.formSettings?.answerAlerts??[])
  const [rules,setRules]=useState<AnswerAlertRule[]>(()=>JSON.parse(serverRules)),[savedRules,setSavedRules]=useState(serverRules)
  const [targets,setTargets]=useState<ChatFormLink[]>(),[operators,setOperators]=useState<Operator[]>()
  const [error,setError]=useState<string>(),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false)
  const [loadError,setLoadError]=useState(false)
  const dirty=JSON.stringify(rules)!==savedRules
  const dirtyRef=useRef(dirty),discardRef=useRef(discardVersion),scrollAfterSave=useRef<number|undefined>(undefined)
  dirtyRef.current=dirty
  useLayoutEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false)},[dirty,onDirtyChange])
  useEffect(()=>{
    if(!dirtyRef.current||discardRef.current!==discardVersion){setRules(JSON.parse(serverRules));setSavedRules(serverRules)}
    if(discardRef.current!==discardVersion){setSaved(false);setError(undefined)}
    discardRef.current=discardVersion
  },[serverRules,discardVersion])
  useLayoutEffect(()=>{if(saved&&scrollAfterSave.current!==undefined){const y=scrollAfterSave.current;window.scrollTo(0,y);const frame=requestAnimationFrame(()=>window.scrollTo(0,y));return()=>cancelAnimationFrame(frame)}},[saved,dirty])
  const loadTargets=()=>chatRequest<{links:ChatFormLink[]}>(`/api/app/flows/${encodeURIComponent(draft.flow.id)}/chat`).then(value=>setTargets(value.links))
  const load=async()=>{setLoadError(false);try{await Promise.all([api.operators().then(setOperators),loadTargets()])}catch{setLoadError(true)}}
  useEffect(()=>{void load()},[draft.flow.id])
  const busy=disabled||saving
  const operands=[...draft.steps.filter(step=>step.kind==='question'),paymentStateOperand]
  const change=(next:AnswerAlertRule[])=>{setRules(next);setSaved(false)}
  const update=(id:string,patch:Partial<AnswerAlertRule>)=>change(rules.map(rule=>rule.id===id?{...rule,...patch}:rule))
  const save=async(retry=false)=>{
    setError(undefined);setSaved(false)
    const issue=answerAlertsIssue(rules);if(issue){setError(issue);return}
    scrollAfterSave.current=window.scrollY;setSaving(true)
    try {
      const result=await onSave(rules,retry)
      if(result==='conflict'){setError('These rules changed elsewhere. Retry to save your changes.');return}
      setSavedRules(JSON.stringify(rules));setSaved(true)
    } catch {setError('Alert rules could not be saved. Check the connection and try again.')}
    finally {setSaving(false)}
  }
  return <details className="answer-alert-settings" onToggle={event=>{if(event.currentTarget.open)void loadTargets().catch(()=>setLoadError(true))}}><summary className="focus-ring">Answer alerts</summary>
    <p>Alerts link to the response; answers stay in Pencil.</p>
    {loadError?<div role="alert">Alert recipients could not load. <button className="quiet-button focus-ring" type="button" onClick={()=>void load()}>Retry</button></div>:null}
    {!operators&&!loadError?<p aria-busy="true">Loading operator recipients…</p>:null}
    {rules.map((rule,index)=><fieldset className="quiet-panel" aria-labelledby={`alert-${rule.id}`} disabled={busy} key={rule.id}><h3 id={`alert-${rule.id}`}>Alert {index+1}</h3>
      <label className="inspector-field">Rule name<input className="text-input" maxLength={100} value={rule.name} onChange={event=>update(rule.id,{name:event.target.value})}/></label>
      <ConditionEditor condition={rule.condition} draft={draft} operands={operands} onChange={condition=>update(rule.id,{condition})}/>
      <fieldset aria-describedby={`recipients-${rule.id}`}><legend>Operator recipients</legend><span id={`recipients-${rule.id}`}>Email and in-app, after release</span>{operators?.map(operator=><label className="toggle-row" key={operator.id}><input type="checkbox" checked={rule.recipientIds.includes(operator.id)} onChange={event=>update(rule.id,{recipientIds:event.target.checked?[...rule.recipientIds,operator.id]:rule.recipientIds.filter(id=>id!==operator.id)})}/><span>{operator.displayName} · {operator.email}</span></label>)}</fieldset>
      <fieldset aria-busy={targets===undefined}><legend>Chat destinations</legend>{(['slack','teams'] as const).map(platform=><label className="toggle-row" key={platform}><input type="checkbox" disabled={!targets?.some(target=>target.platform===platform&&target.armed)} checked={rule.chatPlatforms?.includes(platform)??false} onChange={event=>update(rule.id,{chatPlatforms:event.target.checked?[...(rule.chatPlatforms??[]),platform]:(rule.chatPlatforms??[]).filter(value=>value!==platform)})}/><span>Send to {platform==='slack'?'Slack':'Teams'}</span></label>)}</fieldset>
      <button className="quiet-button focus-ring" type="button" onClick={()=>change(rules.filter(item=>item.id!==rule.id))}>Remove alert {index+1}</button>
    </fieldset>)}
    <div className="builder-actions"><button className="secondary-button focus-ring" type="button" disabled={busy||rules.length>=20} onClick={()=>change([...rules,{id:crypto.randomUUID(),name:'New alert',condition:firstCondition(operands[0],draft),recipientIds:[]}])}>Add alert rule</button>
      <button className="secondary-button focus-ring" type="button" disabled={busy||!operators} onClick={()=>void save()}>Save alert rules</button>
      {saved?<span role="status">Saved. Publish to apply.</span>:null}
    </div>
    {error?<div role="alert">{error} <button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>void save(true)}>Retry</button></div>:null}
  </details>
}
