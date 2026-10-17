import { useEffect, useState } from 'react'
import type { LedgerFilter } from '../../../app/api'
import type { SubmissionOptions } from '../model'
import { submissionsApi } from './client'
export function WorkflowFields({ options, value, onChange }: { options: SubmissionOptions; value: LedgerFilter; onChange: (value: LedgerFilter) => void }) {
 return <><label className="inspector-field">Workflow status<select aria-label="Workflow status" className="text-input" value={value.workflowStatus ?? ''} onChange={e=>onChange({...value,workflowStatus:e.target.value||undefined,offset:0})}><option value="">All statuses</option>{options.statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label className="inspector-field">Assignee<select aria-label="Assignee" className="text-input" value={value.workflowAssignee ?? ''} onChange={e=>onChange({...value,workflowAssignee:e.target.value||undefined,offset:0})}><option value="">All assignees</option><option value="unassigned">Unassigned</option>{options.operators.map(o=><option key={o.id} value={o.id}>{o.displayName}</option>)}</select></label>
 <label className="inspector-field">Tag (exact match)<input className="text-input" maxLength={40} value={value.workflowTag ?? ''} onChange={e=>onChange({...value,workflowTag:e.target.value||undefined,offset:0})} /></label></>
}
export function LedgerWorkflowFilters({ flowId, value, onChange }: { flowId: string; value: LedgerFilter; onChange: (value: LedgerFilter) => void }) {
 const [options,setOptions]=useState<SubmissionOptions>(),[error,setError]=useState<string>(),[tag,setTag]=useState(value.workflowTag??'')
 useEffect(()=>{let active=true;submissionsApi.options(flowId).then(v=>{if(active)setOptions(v)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[flowId])
 useEffect(()=>setTag(value.workflowTag??''),[value.workflowTag])
 if(error)return <p role="alert">{error}</p>
 if(!options)return <p>Loading workflow filters…</p>
 return <><WorkflowFields options={options} value={{...value,workflowTag:tag}} onChange={next=>{setTag(next.workflowTag??'');if(next.workflowStatus!==value.workflowStatus||next.workflowAssignee!==value.workflowAssignee)onChange({...next,workflowTag:value.workflowTag})}} /><button className="secondary-button focus-ring" type="button" onClick={()=>onChange({...value,offset:0,workflowTag:tag.trim()||undefined})}>Filter tag</button></>
}
