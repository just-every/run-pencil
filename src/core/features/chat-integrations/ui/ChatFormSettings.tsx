import './chat-form-settings.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type BuilderDraft, type Operator } from '../../../app/api'
import { ActionForm } from '../../actions/ui'
import type { ActionFieldsInput } from '../../actions/ui'
import { chatFormSchema, safeSummaryTypes, type ChatFormLink, type ChatFormSettings, type ChatPlatform } from '../model'
import { chatRequest, ChatRequestError } from './client'

const emptyAction:ActionFieldsInput={title:'',rationale:'',ownerOperatorId:'',reviewDate:'',metric:{name:'',unit:'',direction:'increase',baselineValue:NaN,baselineSource:'',baselineObservedAt:''}}
const valuesFor = (platform: ChatPlatform, links: ChatFormLink[]) => {
  const link = links.find(row => row.platform === platform)
  return { channel: link?.channel ?? '', owner: link?.operatorId ?? '', userId: (platform === 'slack' ? link?.slackUserId : link?.teamsUserId) ?? '', fields: link?.answerStepIds ?? [], postResponses: link?.postResponses ?? true, actionEnabled: !!link?.action }
}
type Failure = { message: string; retry?: boolean; operation: 'load' | 'save' | 'remove' }
type Field = 'channel' | 'owner' | 'userId' | 'actionOwner'
type FieldErrors = Partial<Record<Field,string>>
// The route's own input check answers with these; they are not written for owners, so the panel says it plainly instead.
const inputRefusals=new Set(['Invalid request body.','Invalid request path parameters.'])
/** Retry only where sending again can succeed: no answer or a server failure. An answered refusal shows the server's reason. */
const saveFailure=(reason:unknown):Failure=>{
  if(!(reason instanceof ChatRequestError))return {message:'Chat settings could not be saved. Check the connection and try again.',operation:'save'}
  if(reason.status>=500)return {message:'Chat settings could not be saved. Try again.',operation:'save'}
  if(reason.status===401)return {message:'Your session ended, so sign in again to save.',operation:'save',retry:false}
  return {message:inputRefusals.has(reason.message)?'Chat settings were refused, so reload the page and save again.':reason.message,operation:'save',retry:false}
}
export function ChatFormSettings({draft,disabled,onDirtyChange,discardVersion}:{draft:BuilderDraft;disabled:boolean;onDirtyChange:(dirty:boolean)=>void;discardVersion:number}) {
  const [links,setLinks]=useState<ChatFormLink[]>([]),[operators,setOperators]=useState<Operator[]>([]),[zone,setZone]=useState('UTC')
  const [platform,setPlatform]=useState<ChatPlatform>('slack'),[values,setValues]=useState(()=>valuesFor('slack',[]))
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState<Failure>(),[notice,setNotice]=useState(false)
  const [actionRead,setActionRead]=useState(0),[actionDirty,setActionDirty]=useState(false)
  const actionRoot=useRef<HTMLDivElement>(null),actionBaseline=useRef(''),pendingAction=useRef<ActionFieldsInput|undefined>(undefined)
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({}),[actionOwnerField,setActionOwnerField]=useState<HTMLSelectElement|null>(null)
  const root=useRef<HTMLDetailsElement>(null),actions=useRef<HTMLDivElement>(null),focusError=useRef(false)
  const scrollAfterSave=useRef<number|undefined>(undefined)
  const path=`/api/app/flows/${encodeURIComponent(draft.flow.id)}/chat`
  const dirty=actionDirty||JSON.stringify(values)!==JSON.stringify(valuesFor(platform,links))
  const saved=links.find(link=>link.platform===platform),locked=disabled||busy||loading
  const {channel,owner,userId,fields,postResponses,actionEnabled}=values
  const actionSnapshot=()=>JSON.stringify(Array.from(actionRoot.current?.querySelectorAll('input,select,textarea')??[]).map(field=>(field as unknown as {value:string}).value))
  const apply=(next:ChatPlatform,rows:ChatFormLink[])=>{setPlatform(next);setValues(valuesFor(next,rows));setActionDirty(false);setFieldErrors({});setActionRead(read=>read+1)}
  const clearField=(field:Field)=>setFieldErrors(current=>({...current,[field]:undefined}))
  const update=(patch:Partial<typeof values>)=>{setValues(current=>({...current,...patch}));for(const key of Object.keys(patch))clearField(key as Field);setNotice(false)}
  const fieldLine=(field:Field)=>fieldErrors[field]?<div id={`chat-${field}-error`} role="alert">{fieldErrors[field]}</div>:null
  const described=(field:Field)=>fieldErrors[field]?`chat-${field}-error`:undefined
  useLayoutEffect(()=>{setActionOwnerField(actionRoot.current?.querySelector('select[required]') as unknown as HTMLSelectElement|null)},[actionEnabled,actionRead,platform])
  useLayoutEffect(()=>{
    if(actionOwnerField){if(fieldErrors.actionOwner){actionOwnerField.setAttribute('aria-describedby','chat-actionOwner-error');actionOwnerField.setAttribute('aria-invalid','true')}else{actionOwnerField.removeAttribute('aria-describedby');actionOwnerField.removeAttribute('aria-invalid')}}
    const first=focusError.current?root.current?.querySelector<HTMLElement>('[aria-invalid=true]'):null;focusError.current=false;if(first){first.focus();first.scrollIntoView({block:'center'})}
  },[fieldErrors,actionOwnerField])
  useLayoutEffect(()=>{actionBaseline.current=actionSnapshot()},[actionRead,actionEnabled,platform])
  useLayoutEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false)},[dirty,onDirtyChange])
  useLayoutEffect(()=>{if(notice&&scrollAfterSave.current!==undefined){const y=scrollAfterSave.current;window.scrollTo(0,y);const frame=requestAnimationFrame(()=>window.scrollTo(0,y));return()=>cancelAnimationFrame(frame)}},[notice,dirty])
  // After a failure, the line, Save and Discard share the viewport.
  useLayoutEffect(()=>{
    const line=error?root.current?.querySelector('#chat-refusal'):null,row=actions.current
    if(!line?.getClientRects().length||!row)return
    const a=line.getBoundingClientRect(),b=row.getBoundingClientRect(),top=Math.min(a.top,b.top),bottom=Math.max(a.bottom,b.bottom)
    if(top<16)window.scrollBy(0,top-16);else if(bottom>window.innerHeight-16)window.scrollBy(0,Math.min(bottom-window.innerHeight+16,top-16))
  },[error])
  const load=async()=>{
    setLoading(true);setError(undefined)
    try { const [data,people,workspace]=await Promise.all([chatRequest<{links:ChatFormLink[]}>(path),api.operators(),api.workspace()]);setLinks(data.links);setOperators(people);setZone(workspace.timeZone);apply(platform,data.links) }
    catch {setError({message:'Chat settings could not load. Try again.',operation:'load'})}
    finally {setLoading(false)}
  }
  useEffect(()=>{void load()},[path,discardVersion])
  useEffect(()=>{setNotice(false);setError(undefined);setFieldErrors({})},[discardVersion])
  const save=async(action?:ActionFieldsInput)=>{
    pendingAction.current=action;setError(undefined);setNotice(false)
    const template=action?(({ownerOperatorId:_owner,...fields})=>fields)(action):undefined
    const input:ChatFormSettings={platform,postResponses,answerStepIds:fields,operatorId:action?.ownerOperatorId??owner,...(platform==='slack'?{channel,slackUserId:userId,...(template?{action:template}:{})}:{teamsUserId:userId})}
    const checked=chatFormSchema.safeParse(input)
    if(!checked.success){
      const next:FieldErrors={}
      if(!chatFormSchema.shape.operatorId.safeParse(input.operatorId).success)next[action?'actionOwner':'owner']='Choose the action owner.'
      if(platform==='slack'&&!chatFormSchema.shape.channel.safeParse(channel).success)next.channel=channel.trim()?(channel.trim().startsWith('#')?"Paste the channel’s ID, not its name.":'Paste a valid Slack channel ID.'):'Paste the Slack channel ID.'
      if(!(platform==='slack'?chatFormSchema.shape.slackUserId:chatFormSchema.shape.teamsUserId).safeParse(userId).success)next.userId=userId.trim()?'Enter a valid chat user ID.':'Enter the owner’s chat user ID.'
      focusError.current=true;setFieldErrors(next)
      if(!Object.keys(next).length)setError({message:'Check the chat and action fields above before saving.',operation:'save',retry:false})
      return
    }
    setFieldErrors({});scrollAfterSave.current=window.scrollY;setBusy(true)
    try {
      const data=await chatRequest<{links:ChatFormLink[]}>(path,'PUT',input)
      setLinks(data.links);apply(platform,data.links);setNotice(true)
    } catch (reason) {setError(saveFailure(reason))}
    finally {setBusy(false)}
  }
  const remove=async()=>{
    scrollAfterSave.current=window.scrollY;setBusy(true);setError(undefined);setNotice(false)
    try {await chatRequest(path+'/'+platform,'DELETE',{});const next=links.filter(link=>link.platform!==platform);setLinks(next);apply(platform,next);setNotice(true)}
    catch {setError({message:'The chat connection could not be removed. Try again.',operation:'remove'})}
    finally {setBusy(false)}
  }
  const discard=()=>{apply(platform,links);setError(undefined);setNotice(false)}
  const retry=()=>{if(error?.operation==='load')void load();else if(error?.operation==='remove')void remove();else void save(pendingAction.current)}
  const failure=error?<div id="chat-refusal" role="alert">{error.message} {error.retry!==false?<button className="quiet-button focus-ring" type="button" disabled={locked} onClick={retry}>Retry</button>:null}</div>:null
  return <details className="chat-form-settings" ref={root}><summary className="focus-ring">Slack and Teams notifications</summary><div aria-busy={busy||loading}>
    <label className="toggle-row"><input type="checkbox" disabled={locked} checked={postResponses} onChange={event=>update({postResponses:event.target.checked})}/><span>Post every released response</span></label>
    <label className="inspector-field">Chat service<select className="text-input" value={platform} disabled={locked} onChange={event=>{if(dirty&&!window.confirm('Discard unsaved chat changes and switch service?'))return;apply(event.target.value as ChatPlatform,links);setNotice(false);setError(undefined)}}><option value="slack">Slack</option><option value="teams">Microsoft Teams</option></select></label>
    {saved?<p>{saved.armed?(saved.postResponses?'Connected for future responses.':'Connected for matching answer alerts.'):'Paused after recovery. Save to reconnect; retained posts do not replay.'}</p>:<p>No form connection saved.</p>}
    {platform==='slack'?<label className="inspector-field">Slack channel ID<input className="text-input" value={channel} disabled={locked} maxLength={200} aria-invalid={fieldErrors.channel?true:undefined} aria-describedby={described('channel')} onChange={event=>update({channel:event.target.value})}/></label>:null}
    {platform==='slack'?fieldLine('channel'):null}
    <label className="inspector-field">Action owner<select className="text-input" value={owner} disabled={locked} aria-invalid={fieldErrors.owner?true:undefined} aria-describedby={described('owner')} onChange={event=>update({owner:event.target.value})}><option value="">Choose an operator</option>{operators.map(operator=><option key={operator.id} value={operator.id}>{operator.displayName}</option>)}</select></label>
    {fieldLine('owner')}
    <label className="inspector-field">{platform==='slack'?'Owner’s Slack user ID':'Owner’s Microsoft user ID'}<input className="text-input" value={userId} disabled={locked} maxLength={200} aria-invalid={fieldErrors.userId?true:undefined} aria-describedby={described('userId')} onChange={event=>update({userId:event.target.value})}/></label>
    {fieldLine('userId')}
    <fieldset disabled={locked} aria-describedby="chat-summary-limits"><legend>Allowed answer summary (optional)</legend><span id="chat-summary-limits">Choices, ratings, yes/no and numbers only; no contact details, free text or uploads.</span>{draft.steps.filter(step=>step.kind==='question'&&safeSummaryTypes.has(step.questionType??'')).map(step=><label className="toggle-row" key={step.id}><input type="checkbox" checked={fields.includes(step.id)} onChange={event=>update({fields:event.target.checked?[...fields,step.id]:fields.filter(id=>id!==step.id)})}/><span>{step.prompt}</span></label>)}</fieldset>
    {platform==='slack'?<label className="toggle-row"><input type="checkbox" disabled={locked} checked={actionEnabled} onChange={event=>update({actionEnabled:event.target.checked})}/><span>Allow the mapped owner to create an action from each post</span></label>:null}
    {platform==='slack'&&actionEnabled?<div ref={actionRoot} onInvalidCapture={event=>{if((event.target as unknown)===actionOwnerField){event.preventDefault();focusError.current=true;setFieldErrors({actionOwner:'Choose the action owner.'})}}} onChange={event=>{if((event.target as unknown)===actionOwnerField)clearField('actionOwner');setActionDirty(actionSnapshot()!==actionBaseline.current);setNotice(false)}}><ActionForm key={actionRead} initial={saved?.action?{...saved.action,ownerOperatorId:owner}:{...emptyAction,ownerOperatorId:owner}} operators={operators} timeZone={zone} busy={locked} submitLabel="Save chat and action template" onSubmit={values=>void save(values)}/>{actionOwnerField?.parentElement&&fieldErrors.actionOwner?createPortal(fieldLine('actionOwner'),actionOwnerField.parentElement):null}</div>:null}
    <div className="builder-actions" ref={actions}>
      {!(platform==='slack'&&actionEnabled)?<button className="secondary-button focus-ring" type="button" disabled={locked} onClick={()=>void save()}>Save chat settings</button>:null}
      {dirty?<button className="quiet-button focus-ring" type="button" disabled={busy} onClick={discard}>Discard changes</button>:null}
      {notice?<span role="status">Saved</span>:null}
      {saved?<button className="quiet-button focus-ring" type="button" disabled={locked} onClick={()=>void remove()}>Remove form chat connection</button>:null}
    </div>
    {failure}
  </div></details>
}
