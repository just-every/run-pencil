import { useEffect, useState } from 'react'
import type { LedgerFilter } from '../../../app/api'
import type { SubmissionOptions } from '../model'
import { submissionsApi } from './client'
import { LiveText } from '../../../shared/ui/LiveText'
import type { FilterChip } from '../../../shared/ui/FilterBar'
export function WorkflowFields({ options, value, onChange }: { options: SubmissionOptions; value: LedgerFilter; onChange: (value: LedgerFilter) => void }) {
 return <><label className="inspector-field">Workflow status<select aria-label="Workflow status" className="text-input" value={value.workflowStatus ?? ''} onChange={e=>onChange({...value,workflowStatus:e.target.value||undefined,offset:0})}><option value="">All statuses</option>{options.statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label className="inspector-field">Assignee<select aria-label="Assignee" className="text-input" value={value.workflowAssignee ?? ''} onChange={e=>onChange({...value,workflowAssignee:e.target.value||undefined,offset:0})}><option value="">All assignees</option><option value="unassigned">Unassigned</option>{options.operators.map(o=><option key={o.id} value={o.id}>{o.displayName}</option>)}</select></label>
 <LiveText label="Tag (exact match)" maxLength={40} value={value.workflowTag ?? ''} onCommit={tag=>onChange({...value,workflowTag:tag.trim()||undefined,offset:0})} /></>
}
/** The chips for the workflow filters in `value`. */
export function workflowChips(options: SubmissionOptions | undefined, value: LedgerFilter, onChange: (value: LedgerFilter) => void): FilterChip[] {
 const chips: FilterChip[] = []
 if (value.workflowStatus) chips.push({ key: 'Status', label: `Status: ${options?.statuses.find(s=>s.id===value.workflowStatus)?.name ?? 'Unavailable status'}`, onRemove: () => onChange({ ...value, workflowStatus: undefined, offset: 0 }) })
 if (value.workflowAssignee) chips.push({ key: 'Assignee', label: `Assignee: ${value.workflowAssignee === 'unassigned' ? 'Unassigned' : options?.operators.find(o=>o.id===value.workflowAssignee)?.displayName ?? 'Former operator'}`, onRemove: () => onChange({ ...value, workflowAssignee: undefined, offset: 0 }) })
 if (value.workflowTag) chips.push({ key: 'Tag', label: `Tag: ${value.workflowTag}`, onRemove: () => onChange({ ...value, workflowTag: undefined, offset: 0 }) })
 return chips
}
/** The workflow options of a flow, read once for the filters that name them. */
export function useSubmissionOptions(flowId: string) {
 const [options,setOptions]=useState<SubmissionOptions>(),[error,setError]=useState<string>()
 useEffect(()=>{let active=true;submissionsApi.options(flowId).then(v=>{if(active)setOptions(v)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[flowId])
 return { options, error }
}
