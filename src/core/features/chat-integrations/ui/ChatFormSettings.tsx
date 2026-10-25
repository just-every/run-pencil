import './chat-form-settings.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, type BuilderDraft, type Operator } from '../../../app/api'
import { ActionForm } from '../../actions/ui'
import type { ActionFieldsInput } from '../../actions/ui'
import { safeSummaryTypes, type ChatFormLink, type ChatFormSettings, type ChatPlatform } from '../model'
import { chatRequest } from './client'

const emptyAction:ActionFieldsInput={title:'',rationale:'',ownerOperatorId:'',reviewDate:'',metric:{name:'',unit:'',direction:'increase',baselineValue:NaN,baselineSource:'',baselineObservedAt:''}}
const valuesFor = (platform: ChatPlatform, links: ChatFormLink[]) => {
  const link = links.find(row => row.platform === platform)
  return { channel: link?.channel ?? '', owner: link?.operatorId ?? '', userId: (platform === 'slack' ? link?.slackUserId : link?.teamsUserId) ?? '', fields: link?.answerStepIds ?? [], postResponses: link?.postResponses ?? true, actionEnabled: !!link?.action }
}
type Failure = { message: string; field?: boolean; operation: 'load' | 'save' | 'remove' }
export function ChatFormSettings({draft,disabled,onDirtyChange,discardVersion}:{draft:BuilderDraft;disabled:boolean;onDirtyChange:(dirty:boolean)=>void;discardVersion:number}) {
  const [links,setLinks]=useState<ChatFormLink[]>([]),[operators,setOperators]=useState<Operator[]>([]),[zone,setZone]=useState('UTC')
  const [platform,setPlatform]=useState<ChatPlatform>('slack'),[values,setValues]=useState(()=>valuesFor('slack',[]))
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState<Failure>(),[notice,setNotice]=useState(false)
  const [actionRead,setActionRead]=useState(0),[actionDirty,setActionDirty]=useState(false)
  const actionRoot=useRef<HTMLDivElement>(null),actionBaseline=useRef(''),pendingAction=useRef<ActionFieldsInput|undefined>(undefined)
  const scrollAfterSave=useRef<number|undefined>(undefined)
  const path=`/api/app/flows/${encodeURIComponent(draft.flow.id)}/chat`
  const dirty=actionDirty||JSON.stringify(values)!==JSON.stringify(valuesFor(platform,links))
  const saved=links.find(link=>link.platform===platform),locked=disabled||busy||loading
  const {channel,owner,userId,fields,postResponses,actionEnabled}=values
  const actionSnapshot=()=>JSON.stringify(Array.from(actionRoot.current?.querySelectorAll('input,select,textarea')??[]).map(field=>(field as unknown as {value:string}).value))
  const apply=(next:ChatPlatform,rows:ChatFormLink[])=>{setPlatform(next);setValues(valuesFor(next,rows));setActionDirty(false);setActionRead(read=>read+1)}
  const update=(patch:Partial<typeof values>)=>{setValues(current=>({...current,...patch}));setNotice(false)}
  useLayoutEffect(()=>{actionBaseline.current=actionSnapshot()},[actionRead,actionEnabled,platform])
  useLayoutEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false)},[dirty,onDirtyChange])
  useLayoutEffect(()=>{if(notice&&scrollAfterSave.current!==undefined){const y=scrollAfterSave.current;window.scrollTo(0,y);const frame=requestAnimationFrame(()=>window.scrollTo(0,y));return()=>cancelAnimationFrame(frame)}},[notice,dirty])
  const load=async()=>{
    setLoading(true);setError(undefined)
    try { const [data,people,workspace]=await Promise.all([chatRequest<{links:ChatFormLink[]}>(path),api.operators(),api.workspace()]);setLinks(data.links);setOperators(people);setZone(workspace.timeZone);apply(platform,data.links) }
    catch {setError({message:'Chat settings could not load. Try again.',operation:'load'})}
    finally {setLoading(false)}
  }
  useEffect(()=>{void load()},[path,discardVersion])
  useEffect(()=>{setNotice(false);setError(undefined)},[discardVersion])
  const save=async(action?:ActionFieldsInput)=>{
    pendingAction.current=action;scrollAfterSave.current=window.scrollY
    setBusy(true);setError(undefined);setNotice(false)
    try {
      const template=action?(({ownerOperatorId:_owner,...fields})=>fields)(action):undefined
      const input:ChatFormSettings={platform,postResponses,answerStepIds:fields,operatorId:action?.ownerOperatorId??owner,...(platform==='slack'?{channel,slackUserId:userId,...(template?{action:template}:{})}:{teamsUserId:userId})}
      const data=await chatRequest<{links:ChatFormLink[]}>(path,'PUT',input)
      setLinks(data.links);apply(platform,data.links);setNotice(true)
    } catch {
      setError(!userId.trim()?{message:'Enter the owner’s chat user ID.',field:true,operation:'save'}:{message:'Chat settings could not be saved. Check the connection and try again.',operation:'save'})
    } finally {setBusy(false)}
  }
  const remove=async()=>{
    scrollAfterSave.current=window.scrollY;setBusy(true);setError(undefined);setNotice(false)
    try {await chatRequest(path+'/'+platform,'DELETE',{});const next=links.filter(link=>link.platform!==platform);setLinks(next);apply(platform,next);setNotice(true)}
    catch {setError({message:'The chat connection could not be removed. Try again.',operation:'remove'})}
    finally {setBusy(false)}
  }
  const retry=()=>{if(error?.operation==='load')void load();else if(error?.operation==='remove')void remove();else void save(pendingAction.current)}
  const failure=error?<div role="alert">{error.message} <button className="quiet-button focus-ring" type="button" disabled={locked} onClick={retry}>Retry</button></div>:null
  return <details className="chat-form-settings"><summary className="focus-ring">Slack and Teams notifications</summary><div aria-busy={busy||loading}>
    <label className="toggle-row"><input type="checkbox" disabled={locked} checked={postResponses} onChange={event=>update({postResponses:event.target.checked})}/><span>Post every released response</span></label>
    <label className="inspector-field">Chat service<select className="text-input" value={platform} disabled={locked} onChange={event=>{if(dirty&&!window.confirm('Discard unsaved chat changes and switch service?'))return;apply(event.target.value as ChatPlatform,links);setNotice(false);setError(undefined)}}><option value="slack">Slack</option><option value="teams">Microsoft Teams</option></select></label>
    {saved?<p>{saved.armed?(saved.postResponses?'Connected for future responses.':'Connected for matching answer alerts.'):'Paused after recovery. Save to reconnect; retained posts do not replay.'}</p>:<p>No form connection saved.</p>}
    {platform==='slack'?<label className="inspector-field">Slack channel ID<input className="text-input" value={channel} disabled={locked} maxLength={200} onChange={event=>update({channel:event.target.value})}/></label>:null}
    <label className="inspector-field">Action owner<select className="text-input" value={owner} disabled={locked} onChange={event=>update({owner:event.target.value})}><option value="">Choose an operator</option>{operators.map(operator=><option key={operator.id} value={operator.id}>{operator.displayName}</option>)}</select></label>
    <label className="inspector-field">{platform==='slack'?'Owner’s Slack user ID':'Owner’s Microsoft user ID'}<input className="text-input" value={userId} disabled={locked} maxLength={200} aria-describedby={error?.field?'chat-user-error':undefined} onChange={event=>update({userId:event.target.value})}/></label>
    {error?.field?<div id="chat-user-error">{failure}</div>:null}
    <fieldset disabled={locked} aria-describedby="chat-summary-limits"><legend>Allowed answer summary (optional)</legend><span id="chat-summary-limits">Choices, ratings, yes/no and numbers only; no contact details, free text or uploads.</span>{draft.steps.filter(step=>step.kind==='question'&&safeSummaryTypes.has(step.questionType??'')).map(step=><label className="toggle-row" key={step.id}><input type="checkbox" checked={fields.includes(step.id)} onChange={event=>update({fields:event.target.checked?[...fields,step.id]:fields.filter(id=>id!==step.id)})}/><span>{step.prompt}</span></label>)}</fieldset>
    {platform==='slack'?<label className="toggle-row"><input type="checkbox" disabled={locked} checked={actionEnabled} onChange={event=>update({actionEnabled:event.target.checked})}/><span>Allow the mapped owner to create an action from each post</span></label>:null}
    {platform==='slack'&&actionEnabled?<div ref={actionRoot} onChange={()=>{setActionDirty(actionSnapshot()!==actionBaseline.current);setNotice(false)}}><ActionForm key={actionRead} initial={saved?.action?{...saved.action,ownerOperatorId:owner}:{...emptyAction,ownerOperatorId:owner}} operators={operators} timeZone={zone} busy={locked} submitLabel="Save chat and action template" onSubmit={values=>void save(values)}/></div>:null}
    <div className="builder-actions">
      {!(platform==='slack'&&actionEnabled)?<button className="secondary-button focus-ring" type="button" disabled={locked} onClick={()=>void save()}>Save chat settings</button>:null}
      {notice?<span role="status">Saved</span>:null}
      {saved?<button className="quiet-button focus-ring" type="button" disabled={locked} onClick={()=>void remove()}>Remove form chat connection</button>:null}
    </div>
    {error&&!error.field?failure:null}
  </div></details>
}
