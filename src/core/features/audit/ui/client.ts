import type { AuditFilters, AuditOptions, AuditPage, AuditQuery } from '../model'
export function auditQuery(value: AuditQuery) { return new URLSearchParams(Object.entries(value).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>[k,String(v)])).toString() }
async function read<T>(url:string):Promise<T>{const response=await fetch(url,{credentials:'same-origin'}),value=await response.json() as T&{message?:string};if(!response.ok)throw new Error(value.message??'Audit history could not load.');return value}
export const auditApi={
 page:(query:AuditQuery)=>read<AuditPage>('/api/app/audit?'+auditQuery(query)),
 options:(actorSearch='',formSearch='')=>read<AuditOptions>('/api/app/audit/options?'+new URLSearchParams({actorSearch,formSearch})),
 exportUrl:(filters:AuditFilters,cursor:string)=>'/api/app/audit/export?'+auditQuery({...filters,cursor}),
}
export function activity(kind:string){return kind.replaceAll('.',' · ').replaceAll('_',' ').replaceAll('-',' ')}
