import './answer-alerts.css'
import { useEffect, useState } from 'react'
import { api, type BuilderDraft, type Operator } from '../../app/api'
import { answerAlertsIssue, paymentStateOperand, type AnswerAlertRule } from '../../shared/answerAlerts'
import { ConditionEditor, firstCondition } from '../flows/ui'
import { chatRequest, type ChatFormLink } from '../chat-integrations/ui'

export function AnswerAlertSettings({draft,disabled,onSave}:{draft:BuilderDraft;disabled:boolean;onSave:(rules:AnswerAlertRule[])=>Promise<void>}) {
  const [rules,setRules]=useState<AnswerAlertRule[]>(draft.formSettings?.answerAlerts??[])
  const [targets,setTargets]=useState<ChatFormLink[]>()
  const [operators,setOperators]=useState<Operator[]>(),[error,setError]=useState<string>(),[saving,setSaving]=useState(false)
  useEffect(()=>{let active=true;void api.operators().then(value=>{if(active)setOperators(value)}).catch(()=>{if(active)setError('Operator recipients could not be loaded.')});return()=>{active=false}},[])
  useEffect(()=>{let active=true;void chatRequest<{links:ChatFormLink[]}>(`/api/app/flows/${encodeURIComponent(draft.flow.id)}/chat`).then(value=>{if(active)setTargets(value.links)}).catch(()=>{if(active)setError('Chat targets could not be loaded.')});return()=>{active=false}},[draft.flow.id])
  const busy=disabled||saving
  const operands=[...draft.steps.filter(step=>step.kind==='question'),paymentStateOperand]
  const update=(id:string,patch:Partial<AnswerAlertRule>)=>setRules(current=>current.map(rule=>rule.id===id?{...rule,...patch}:rule))
  return <details className="answer-alert-settings" onToggle={event=>{if(event.currentTarget.open)void chatRequest<{links:ChatFormLink[]}>(`/api/app/flows/${encodeURIComponent(draft.flow.id)}/chat`).then(value=>setTargets(value.links)).catch(()=>setError('Chat targets could not be loaded.'))}}><summary className="focus-ring">Answer alerts</summary>
    <p>Match answers, hidden fields, calculations or payment state. Named operators receive email and an in-app alert after release. Messages contain the flow, rule and a sign-in link; answers stay in Pencil.</p>
    {error?<p role="alert">{error}</p>:null}
    {!operators?<p aria-busy="true">Loading operator recipients…</p>:null}
    {rules.map((rule,index)=><fieldset className="quiet-panel" disabled={busy} key={rule.id}><legend>Alert {index+1}</legend>
      <label className="inspector-field">Rule name<input className="text-input" maxLength={100} value={rule.name} onChange={event=>update(rule.id,{name:event.target.value})}/></label>
      <ConditionEditor condition={rule.condition} draft={draft} operands={operands} onChange={condition=>update(rule.id,{condition})}/>
      <fieldset><legend>Operator recipients</legend>{operators?.map(operator=><label className="toggle-row" key={operator.id}><input type="checkbox" checked={rule.recipientIds.includes(operator.id)} onChange={event=>update(rule.id,{recipientIds:event.target.checked?[...rule.recipientIds,operator.id]:rule.recipientIds.filter(id=>id!==operator.id)})}/><span>{operator.displayName} · {operator.email}</span></label>)}</fieldset>
      <fieldset aria-busy={targets===undefined}><legend>Chat destinations</legend><p>Choose this form’s connected targets. Chat alerts contain the flow, rule and sign-in link, never answers.</p>{(['slack','teams'] as const).map(platform=><label className="toggle-row" key={platform}><input type="checkbox" disabled={!targets?.some(target=>target.platform===platform&&target.armed)} checked={rule.chatPlatforms?.includes(platform)??false} onChange={event=>update(rule.id,{chatPlatforms:event.target.checked?[...(rule.chatPlatforms??[]),platform]:(rule.chatPlatforms??[]).filter(value=>value!==platform)})}/><span>Send to {platform==='slack'?'Slack':'Teams'}</span></label>)}<p>Configure targets in Slack and Teams notifications.</p></fieldset>
      <button className="quiet-button focus-ring" type="button" onClick={()=>setRules(current=>current.filter(item=>item.id!==rule.id))}>Remove alert {index+1}</button>
    </fieldset>)}
    <div className="builder-actions"><button className="secondary-button focus-ring" type="button" disabled={busy||rules.length>=20} onClick={()=>setRules(current=>[...current,{id:crypto.randomUUID(),name:'New alert',condition:firstCondition(operands[0],draft),recipientIds:[]}])}>Add alert rule</button>
    <button className="secondary-button focus-ring" type="button" disabled={busy||!operators} onClick={async()=>{setError(undefined);const issue=answerAlertsIssue(rules);if(issue){setError(issue);return}setSaving(true);try{await onSave(rules)}catch(reason){setError(reason instanceof Error?reason.message:'Alert settings could not be saved.')}finally{setSaving(false)}}}>Save alert rules</button></div>
  </details>
}
