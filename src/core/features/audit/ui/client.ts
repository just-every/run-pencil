import type { AuditFilters, AuditOptions, AuditPage, AuditQuery } from '../model'
export function auditQuery(value: AuditQuery) { return new URLSearchParams(Object.entries(value).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>[k,String(v)])).toString() }
async function read<T>(url:string):Promise<T>{const response=await fetch(url,{credentials:'same-origin'}),value=await response.json() as T&{message?:string};if(!response.ok)throw new Error(value.message??'Audit history could not load.');return value}
export const auditApi={
 page:(query:AuditQuery)=>read<AuditPage>('/api/app/audit?'+auditQuery(query)),
 options:(actorSearch='',formSearch='')=>read<AuditOptions>('/api/app/audit/options?'+new URLSearchParams({actorSearch,formSearch})),
 exportUrl:(filters:AuditFilters,cursor:string)=>'/api/app/audit/export?'+auditQuery({...filters,cursor}),
}
const plainActivity:Record<string,string>={'operator.setup_bootstrapped':'Workspace set up','operator.invitation_retained':'Invitation kept','auth.magic_link_prepared':'Sign-in link prepared','auth.magic_link_sent':'Sign-in link sent','auth.magic_link_failed':'Sign-in link failed'}
/** An event kind in people's words: "action.created" reads "Action created". */
export function activity(kind:string){if(Object.hasOwn(plainActivity,kind))return plainActivity[kind];const words=kind.replace(/[._-]+/g,' ').trim();return words.charAt(0).toUpperCase()+words.slice(1)}
