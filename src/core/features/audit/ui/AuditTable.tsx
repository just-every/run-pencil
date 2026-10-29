import type { AuditRow } from '../model'
import { activity } from './client'
export function AuditTable({rows,time}:{rows:AuditRow[];time:(date:string)=>string}) {
 return <table><colgroup><col/><col/><col/><col/><col/></colgroup><thead><tr><th>Date & time</th><th>Actor</th><th>Activity</th><th>Form</th><th>Details</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td data-label="Date & time">{time(row.createdAt)}</td><td data-label="Actor"><span className="actor">{row.actor?.name??'Former team member or system'}</span></td><td data-label="Activity"><span className="workflow-badge">{activity(row.kind)}</span></td><td data-label="Form">{row.form?.name??'Whole workspace'}</td><td data-label="Details">{Object.entries(row.details).length?Object.entries(row.details).map(([k,v])=>`${k === 'approvedBy' ? 'Approved by' : k}: ${v}`).join(' · '):'Activity recorded'}</td></tr>)}</tbody></table>
}
