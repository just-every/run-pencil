import './answer-alerts.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, ApiError, type BuilderDraft, type Operator } from '../../app/api'
import { answerAlertsIssue, answerAlertFieldIssues, paymentStateOperand, type AnswerAlertRule } from '../../shared/answerAlerts'
import { ConditionEditor, firstCondition } from '../flows/ui'
import { chatRequest, type ChatFormLink } from '../chat-integrations/ui'

type Props={draft:BuilderDraft;disabled:boolean;discardVersion:number;onDirtyChange:(dirty:boolean)=>void;onSave:(rules:AnswerAlertRule[],retry:boolean)=>Promise<'saved'|'conflict'>}
/** Retry is offered only where sending again can succeed; an answered refusal offers Reload, which re-reads the server's rules. */
type Failure={message:string;action?:'retry'|'reload';ruleId?:string;field?:'recipientIds'|'chat'}
// The routes' own input check answers with these; they are not written for owners, so the panel says it plainly instead.
const inputRefusals=new Set(['Invalid request body.','Invalid request path parameters.'])
const sessionEnded:Failure={message:'Your session ended, so sign in again to save.'}
export function AnswerAlertSettings({draft,disabled,onSave,onDirtyChange,discardVersion}:Props) {
  const serverRules=JSON.stringify(draft.formSettings?.answerAlerts??[])
  const [rules,setRules]=useState<AnswerAlertRule[]>(()=>JSON.parse(serverRules)),[savedRules,setSavedRules]=useState(serverRules)
  const [targets,setTargets]=useState<ChatFormLink[]>(),[operators,setOperators]=useState<Operator[]>()
  const [error,setError]=useState<Failure>(),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false)
  const [fieldErrors,setFieldErrors]=useState<Record<string,ReturnType<typeof answerAlertFieldIssues>>>({})
  const [readVersion,setReadVersion]=useState<number>()
  const root=useRef<HTMLDetailsElement>(null),actions=useRef<HTMLDivElement>(null),focusError=useRef(false)
  const [loadError,setLoadError]=useState(false)
  const dirty=JSON.stringify(rules)!==savedRules
  const dirtyRef=useRef(dirty),discardRef=useRef(discardVersion),scrollAfterSave=useRef<number|undefined>(undefined)
  dirtyRef.current=dirty
  useLayoutEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false)},[dirty,onDirtyChange])
  useEffect(()=>{
    if(!dirtyRef.current||discardRef.current!==discardVersion){setRules(JSON.parse(serverRules));setSavedRules(serverRules)}
    if(discardRef.current!==discardVersion){setSaved(false);setError(undefined);setFieldErrors({})}
    discardRef.current=discardVersion
  },[serverRules,discardVersion])
  useLayoutEffect(()=>{if(saved&&scrollAfterSave.current!==undefined){const y=scrollAfterSave.current;window.scrollTo(0,y);const frame=requestAnimationFrame(()=>window.scrollTo(0,y));return()=>cancelAnimationFrame(frame)}},[saved,dirty])
  // After a failure, the line, Save and Discard share the viewport.
  useLayoutEffect(()=>{
    const line=error?root.current?.querySelector('#alert-refusal'):null,row=actions.current
    if(!line?.getClientRects().length||!row)return
    const a=line.getBoundingClientRect(),b=row.getBoundingClientRect(),top=Math.min(a.top,b.top),bottom=Math.max(a.bottom,b.bottom)
    if(top<16)window.scrollBy(0,top-16);else if(bottom>window.innerHeight-16)window.scrollBy(0,Math.min(bottom-window.innerHeight+16,top-16))
  },[error])
  const readTargets=()=>chatRequest<{links:ChatFormLink[]}>(`/api/app/flows/${encodeURIComponent(draft.flow.id)}/chat`).then(value=>{setTargets(value.links);return value.links})
  const load=async()=>{setLoadError(false);try{await Promise.all([api.operators().then(setOperators),readTargets()])}catch{setLoadError(true)}}
  useEffect(()=>{void load()},[draft.flow.id])
  const busy=disabled||saving
  const operands=[...draft.steps.filter(step=>step.kind==='question'),paymentStateOperand]
  const connected=(platform:'slack'|'teams')=>!!targets?.some(target=>target.platform===platform&&target.armed)
  const change=(next:AnswerAlertRule[])=>{setRules(next);setSaved(false)}
  const update=(id:string,patch:Partial<AnswerAlertRule>)=>{
    change(rules.map(rule=>rule.id===id?{...rule,...patch}:rule));setFieldErrors(current=>({...current,[id]:Object.fromEntries(Object.entries(current[id]??{}).filter(([key])=>!(key in patch)))}))
    if(error?.ruleId===id&&(error.field==='chat'?'chatPlatforms':'recipientIds') in patch)setError(undefined)
  }
  const line=(id:string,field:'name'|'recipientIds'|'condition')=>fieldErrors[id]?.[field]?<div id={`alert-${id}-${field}-error`} role="alert">{fieldErrors[id][field]}</div>:null
  const described=(id:string,field:'name'|'recipientIds'|'condition')=>fieldErrors[id]?.[field]?`alert-${id}-${field}-error`:undefined
  useLayoutEffect(()=>{const first=focusError.current?root.current?.querySelector<HTMLElement>('[aria-invalid=true]'):null;focusError.current=false;if(first){const control=first.matches('input,select,textarea')?first:first.querySelector<HTMLElement>('input,select,textarea');control?.focus();first.scrollIntoView({block:'center'})}},[fieldErrors])
  // The rule a validation refusal names, found the way the server checks: recipients, then chat targets, rule by rule.
  const refusedRule=(links:ChatFormLink[]|undefined):Pick<Failure,'ruleId'|'field'>=>{
    for(const rule of rules){
      if(operators&&rule.recipientIds.some(id=>!operators.some(operator=>operator.id===id)))return {ruleId:rule.id,field:'recipientIds'}
      if((rule.chatPlatforms??[]).some(platform=>!links?.some(link=>link.platform===platform&&link.armed)))return {ruleId:rule.id,field:'chat'}
    }
    return {}
  }
  const failureFor=async(reason:unknown):Promise<Failure>=>{
    if(!(reason instanceof ApiError))return {message:'Alert rules could not be saved. Check the connection and try again.',action:'retry'}
    if(reason.status>=500)return {message:'Alert rules could not be saved. Try again.',action:'retry'}
    if(reason.status===401)return sessionEnded
    const placed=reason.code==='VALIDATION_ERROR'?refusedRule(await readTargets().catch(()=>targets)):{}
    return {message:inputRefusals.has(reason.message)?'Alert rules were refused, so reload them and try again.':reason.message,action:'reload',...placed}
  }
  const conflict:Failure={message:'These rules changed elsewhere, so reload to see them.',action:'reload'}
  const save=async(retry=false)=>{
    setError(undefined);setSaved(false)
    const fields=Object.fromEntries(rules.map(rule=>[rule.id,answerAlertFieldIssues(rule,draft)]))
    focusError.current=true;setFieldErrors(fields)
    if(Object.values(fields).some(issue=>Object.keys(issue).length))return
    if(answerAlertsIssue(rules)){setError({message:'Check the alert rules above before saving.'});return}
    scrollAfterSave.current=window.scrollY;setSaving(true)
    try {
      // After Reload the panel holds a newer read than the page; save on that read only if nothing changed since.
      const reread=!retry&&readVersion!==undefined&&readVersion>draft.flow.draftVersion
      if(reread&&(await api.builder(draft.flow.id)).flow.draftVersion!==readVersion){setError(conflict);return}
      const result=await onSave(rules,retry||reread)
      if(result==='conflict'){setError(conflict);return}
      setSavedRules(JSON.stringify(rules));setSaved(true)
    } catch(reason) {setError(await failureFor(reason))}
    finally {setSaving(false)}
  }
  const reload=async()=>{
    setError(undefined);setSaved(false);setSaving(true)
    try {
      const latest=await api.builder(draft.flow.id),json=JSON.stringify(latest.formSettings?.answerAlerts??[])
      setRules(JSON.parse(json));setSavedRules(json);setReadVersion(latest.flow.draftVersion);setFieldErrors({})
      await readTargets().catch(()=>setLoadError(true))
    } catch(reason) {setError(reason instanceof ApiError&&reason.status===401?sessionEnded:{message:'Alert rules could not reload. Check the connection and try again.',action:'reload'})}
    finally {setSaving(false)}
  }
  const discard=()=>{setRules(JSON.parse(savedRules));setError(undefined);setFieldErrors({});setSaved(false)}
  const placedIn=error?.ruleId&&rules.some(rule=>rule.id===error.ruleId)?error.ruleId:undefined
  const failure=(placed:boolean)=>error&&!!placedIn===placed?<div id="alert-refusal" role="alert">{error.message} {error.action?<button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>void(error.action==='retry'?save(true):reload())}>{error.action==='retry'?'Retry':'Reload'}</button>:null}</div>:null
  const refusalIn=(id:string,field:Failure['field'])=>placedIn===id&&error?.field===field?failure(true):null
  return <details ref={root} className="answer-alert-settings" onToggle={event=>{if(event.currentTarget.open)void readTargets().catch(()=>setLoadError(true))}}><summary className="focus-ring">Answer alerts</summary>
    <p>Alerts link to the response; answers stay in Pencil.</p>
    {loadError?<div role="alert">Alert recipients could not load. <button className="quiet-button focus-ring" type="button" onClick={()=>void load()}>Retry</button></div>:null}
    {!operators&&!loadError?<p aria-busy="true">Loading operator recipients…</p>:null}
    {rules.map((rule,index)=><fieldset className="quiet-panel" aria-labelledby={`alert-${rule.id}`} disabled={busy} key={rule.id}><h3 id={`alert-${rule.id}`}>Alert {index+1}</h3>
      <label className="inspector-field">Rule name<input className="text-input" maxLength={100} value={rule.name} aria-invalid={fieldErrors[rule.id]?.name?true:undefined} aria-describedby={described(rule.id,'name')} onChange={event=>update(rule.id,{name:event.target.value})}/></label>
      {line(rule.id,'name')}
      <div role="group" aria-label="Alert condition" aria-invalid={fieldErrors[rule.id]?.condition?true:undefined} aria-describedby={described(rule.id,'condition')}><ConditionEditor condition={rule.condition} draft={draft} operands={operands} onChange={condition=>update(rule.id,{condition})}/>{line(rule.id,'condition')}</div>
      <fieldset aria-invalid={fieldErrors[rule.id]?.recipientIds?true:undefined} aria-describedby={[`recipients-${rule.id}`,described(rule.id,'recipientIds'),error?.ruleId===rule.id&&error.field==='recipientIds'?'alert-refusal':undefined].filter(Boolean).join(' ')}><legend>Operator recipients</legend><span id={`recipients-${rule.id}`}>Email and in-app, after release</span>{operators?.map(operator=><label className="toggle-row" key={operator.id}><input type="checkbox" aria-describedby={described(rule.id,'recipientIds')} checked={rule.recipientIds.includes(operator.id)} onChange={event=>update(rule.id,{recipientIds:event.target.checked?[...rule.recipientIds,operator.id]:rule.recipientIds.filter(id=>id!==operator.id)})}/><span>{operator.displayName} · {operator.email}</span></label>)}{line(rule.id,'recipientIds')}{refusalIn(rule.id,'recipientIds')}</fieldset>
      <fieldset aria-busy={targets===undefined} aria-describedby={error?.ruleId===rule.id&&error.field==='chat'?'alert-refusal':undefined}><legend>Chat destinations</legend>{(['slack','teams'] as const).map(platform=>{const checked=rule.chatPlatforms?.includes(platform)??false;return <label className="toggle-row" key={platform}><input type="checkbox" disabled={!checked&&!connected(platform)} checked={checked} onChange={event=>update(rule.id,{chatPlatforms:event.target.checked?[...(rule.chatPlatforms??[]),platform]:(rule.chatPlatforms??[]).filter(value=>value!==platform)})}/><span>Send to {platform==='slack'?'Slack':'Teams'}</span></label>})}{refusalIn(rule.id,'chat')}</fieldset>
      <button className="quiet-button focus-ring" type="button" onClick={()=>change(rules.filter(item=>item.id!==rule.id))}>Remove alert {index+1}</button>
    </fieldset>)}
    <div className="builder-actions" ref={actions}><button className="secondary-button focus-ring" type="button" disabled={busy||rules.length>=20} onClick={()=>change([...rules,{id:crypto.randomUUID(),name:'New alert',condition:firstCondition(operands[0],draft),recipientIds:[]}])}>Add alert rule</button>
      <button className="secondary-button focus-ring" type="button" disabled={busy||!operators} onClick={()=>void save()}>Save alert rules</button>
      {dirty?<button className="quiet-button focus-ring" type="button" disabled={saving} onClick={discard}>Discard changes</button>:null}
      {saved?<span role="status">Saved. Publish to apply.</span>:null}
    </div>
    {failure(false)}
  </details>
}
