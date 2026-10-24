import { env } from 'cloudflare:test'
import { expect, vi } from 'vitest'
import type { actionsHttp } from './actions-fixture'
import { matureLoad } from './load-time-fixture'
import { materializeConfirmations } from '../../src/core/features/notifications/confirmation-queue'
export async function proveResponseEdit(f:Awaited<ReturnType<typeof actionsHttp>>,received:Array<{body:string;eventType:string;signature:string}>,expectedSignature:(secret:string,body:string)=>Promise<string>) {
 const created=await f.services.flows.createDraftFlow({workspaceId:f.workspaceId,title:'Synthetic editable feedback',slug:'synthetic-pencil-edit'})
 const scope={workspaceId:f.workspaceId,flowId:created.id}
 const draft=()=>f.services.flows.getBuilderDraft(f.workspaceId,created.id)
 for(const step of [{kind:'question' as const,questionType:'email' as const,prompt:'Confirmation mailbox',required:true},{kind:'question' as const,questionType:'number' as const,prompt:'Quantity',required:true},{kind:'completion' as const,questionType:null,prompt:'Recorded'}])await f.services.flows.addDraftStep({...scope,expectedVersion:(await draft()).flow.draftVersion,step})
 const initial=await draft(),[email,quantity]=initial.steps
 await f.services.flows.updateFormSettings({...scope,expectedVersion:initial.flow.draftVersion,settings:{...initial.formSettings!,calculations:[{id:'synthetic-total',name:'Total',type:'number',expression:{kind:'multiply',left:{kind:'answer',stepId:quantity.id},right:{kind:'literal',value:2}}}],responseEdits:{enabled:true,deadline:new Date(Date.now()+86400000).toISOString()},confirmation:{enabled:true,includeAnswers:false,answerTypes:[],emailStepId:email.id,subject:'Synthetic receipt',body:'Recorded.'}}})
 await f.services.flows.publishDraft({...scope,expectedVersion:(await draft()).flow.draftVersion})
 const call=(path:string,body?:unknown)=>f.app.request(`http://localhost${path}`,{method:body===undefined?'GET':'POST',headers:{Host:'localhost',Origin:'http://localhost','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.191'},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const okay=async<T,>(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const hook=await okay<{endpoint:{id:string};secret:string}>(await f.call('/api/app/webhooks',{url:'http://127.0.0.1:9/edit',flowId:created.id}),201)
 const session=await okay<{sessionId:string;sessionToken:string;loadTime:string;revisionId:string}>(await call('/api/public/flows/synthetic-pencil-edit/sessions',{deviceClass:'desktop',source:'direct'}),201)
 await matureLoad(session,5000)
 const answers=[{stepId:email.id,value:'synthetic-pencil-edit@example.test'},{stepId:quantity.id,value:3}]
 await okay(await call('/api/public/flows/synthetic-pencil-edit/responses',{...session,idempotencyKey:'synthetic-pencil-edit-key',answers}),201)
 const row=(await env.DB.prepare('SELECT id FROM responses WHERE session_id=?').bind(session.sessionId).first<{id:string}>())!
 await materializeConfirmations(env.DB,new Date().toISOString())
 const confirmation=(await env.DB.prepare('SELECT message_json AS message FROM confirmation_deliveries WHERE response_id=?').bind(row.id).first<{message:string}>())!
 const token=/\?edit=([a-f0-9]{64})/.exec(JSON.parse(confirmation.message).text)![1]
 const read=await okay<{answers:typeof answers;flow:{formSettings:{answerAlerts?:unknown}}}>(await call(`/api/public/flows/synthetic-pencil-edit/edit?token=${token}`))
 expect(read.answers).toEqual(expect.arrayContaining(answers));expect(read.flow.formSettings.answerAlerts).toBeUndefined()
 // A valid capability is refused while its form is closed, after expiry and after the deadline.
 await f.services.flows.closeFlow(f.workspaceId,created.id,f.owner.operatorId)
 expect((await call(`/api/public/flows/synthetic-pencil-edit/edit?token=${token}`)).status).toBe(404)
 expect((await call('/api/public/flows/synthetic-pencil-edit/edit',{token,answers})).status).toBe(404)
 await f.services.flows.reopenFlow(f.workspaceId,created.id,f.owner.operatorId)
 const linkExpiry=(await env.DB.prepare('SELECT expires_at AS expires FROM response_edit_links WHERE response_id=?').bind(row.id).first<{expires:string}>())!.expires
 await env.DB.prepare("UPDATE response_edit_links SET expires_at='2000-01-01T00:00:00.000Z' WHERE response_id=?").bind(row.id).run()
 expect((await call(`/api/public/flows/synthetic-pencil-edit/edit?token=${token}`)).status).toBe(404)
 await env.DB.prepare('UPDATE response_edit_links SET expires_at=? WHERE response_id=?').bind(linkExpiry,row.id).run()
 vi.setSystemTime(new Date(Date.now()+2*86400000))
 try {expect((await call(`/api/public/flows/synthetic-pencil-edit/edit?token=${token}`)).status).toBe(404)} finally {vi.useRealTimers()}
 const edited=[answers[0],{stepId:quantity.id,value:7}]
 const result=await okay<{version:number}>(await call('/api/public/flows/synthetic-pencil-edit/edit',{token,answers:edited}))
 expect(result.version).toBe(2)
 const history=await okay<{versions:Array<{number:number;current:boolean;answers:typeof answers;context:{calculations:Record<string,number>}}> }>(await f.call(`/api/app/responses/${row.id}/versions`))
 expect(history.versions).toHaveLength(2)
 expect(history.versions[0]).toMatchObject({number:2,current:true,answers:expect.arrayContaining(edited),context:{calculations:{'synthetic-total':14}}})
 expect(history.versions[1]).toMatchObject({number:1,current:false,answers:expect.arrayContaining(answers),context:{calculations:{'synthetic-total':6}}})
 const ledger=await okay<{responses:Array<{id:string;calculations:Array<{value:number}>}>}>(await f.call(`/api/app/flows/${created.id}/ledger`))
 expect(ledger.responses.find(response=>response.id===row.id)!.calculations).toEqual(expect.arrayContaining([expect.objectContaining({value:14})]))
 expect((await call(`/api/public/flows/synthetic-pencil-edit/edit?token=${token}`)).status).toBe(404)
 expect((await call('/api/public/flows/synthetic-pencil-edit/edit',{token,answers})).status).toBe(404)
 await f.services.webhooks.dispatcher.run(new Date(Date.now()+60000).toISOString())
 const events=received.filter(item=>item.eventType==='response.updated' && JSON.parse(item.body).responseId===row.id)
 expect(events).toHaveLength(1);expect(JSON.parse(events[0].body)).toMatchObject({type:'response.updated',responseId:row.id,formId:created.id,revisionId:session.revisionId});expect(events[0].signature).toBe(await expectedSignature(hook.secret,events[0].body));expect(events[0].body).not.toContain('synthetic-pencil-edit@example.test')
 await f.services.responses.eraseReleasedResponse({workspaceId:f.workspaceId,responseId:row.id,operatorId:f.owner.operatorId})
 expect((await env.DB.prepare('SELECT number FROM response_versions WHERE response_id=?').bind(row.id).all()).results).toHaveLength(0)
 expect((await env.DB.prepare('SELECT hash FROM response_edit_links WHERE response_id=?').bind(row.id).all()).results).toHaveLength(0)
 expect((await call(`/api/public/flows/synthetic-pencil-edit/edit?token=${token}`)).status).toBe(404)
 await f.call(`/api/app/webhooks/${hook.endpoint.id}`,undefined,{method:'DELETE'})
}
