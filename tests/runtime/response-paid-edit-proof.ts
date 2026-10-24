import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import type { actionsHttp } from './actions-fixture'
import { matureLoad } from './load-time-fixture'
import { materializeConfirmations } from '../../src/core/features/notifications/confirmation-queue'
import { deliver, stripe, stripeEvent, stripeKey, webhookSecret } from './payment-fixture'

/** A paid response is collected and edited through the same public doors as its respondent. */
export async function provePaidResponseEdit(f:Awaited<ReturnType<typeof actionsHttp>>) {
 const okay=async<T,>(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.status===204?undefined as T:response.json() as Promise<T>}
 await okay(await f.call('/api/app/connections/payment',{secretKey:stripeKey,webhookSecret},{method:'PUT'}))
 const slug='synthetic-pencil-paid-edit',created=await f.services.flows.createDraftFlow({workspaceId:f.workspaceId,title:'Synthetic paid editable order',slug})
 const scope={workspaceId:f.workspaceId,flowId:created.id},draft=()=>f.services.flows.getBuilderDraft(f.workspaceId,created.id)
 for(const step of [{kind:'question' as const,questionType:'email' as const,prompt:'Receipt mailbox',required:true},{kind:'question' as const,questionType:'number' as const,prompt:'Units',required:true,questionSettings:{min:1,max:10,decimalPlaces:0}},{kind:'completion' as const,questionType:null,prompt:'Order recorded'}])await f.services.flows.addDraftStep({...scope,expectedVersion:(await draft()).flow.draftVersion,step})
 const initial=await draft(),[email,quantity,completion]=initial.steps
 const payment=await f.services.flows.addDraftStep({...scope,expectedVersion:initial.flow.draftVersion,step:{kind:'payment',questionType:null,prompt:'Pay for the units',nextStepId:completion.id,questionSettings:{payment:{products:[{id:'synthetic-pencil-product',name:'Synthetic unit',unitAmount:500,quantityStepId:quantity.id}],options:[],minimum:50,maximum:100000}}}})
 expect(payment.kind).toBe('created')
 if(payment.kind!=='created')throw new Error('The synthetic payment step could not be authored.')
 await f.services.flows.updateBuilderDraft({...scope,expectedVersion:(await draft()).flow.draftVersion,stepId:quantity.id,prompt:quantity.prompt,required:true,nextStepId:payment.step.id})
 const current=await draft()
 await f.services.flows.updateFormSettings({...scope,expectedVersion:current.flow.draftVersion,settings:{...current.formSettings!,responseEdits:{enabled:true,deadline:new Date(Date.now()+86400000).toISOString()},confirmation:{enabled:true,includeAnswers:false,answerTypes:[],emailStepId:email.id,subject:'Synthetic paid receipt',body:'Order recorded.'}}})
 await okay(await f.call(`/api/app/flows/${created.id}/publish`,{expectedVersion:(await draft()).flow.draftVersion}),201)
 const call=(path:string,body?:unknown)=>f.app.request(`http://localhost${path}`,{method:body===undefined?'GET':'POST',headers:{Host:'localhost',Origin:'http://localhost','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.192'},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const session=await okay<{sessionId:string;sessionToken:string;loadTime:string}>(await call(`/api/public/flows/${slug}/sessions`,{deviceClass:'desktop',source:'direct'}),201)
 await matureLoad(session,5000)
 const answers=[{stepId:email.id,value:'synthetic-pencil-paid-edit@example.test'},{stepId:quantity.id,value:3}]
 const receipt=await okay<{responseId:string;payment:{state:string;checkoutUrl:string}}>(await call(`/api/public/flows/${slug}/responses`,{...session,idempotencyKey:'synthetic-pencil-paid-edit-key',answers}),201)
 expect(receipt.payment.state).toBe('pending')
 const settled=await stripe.settle('complete',receipt.payment.checkoutUrl.split('/').at(-1)!)
 expect(await deliver(await stripeEvent('checkout.session.completed',settled))).toMatchObject({status:200,outcome:'applied'})
 const paymentRow=()=>env.DB.prepare('SELECT * FROM response_payments WHERE response_id=?').bind(receipt.responseId).first()
 const before=await paymentRow();expect(before).toMatchObject({state:'paid',amount:1500})
 const ledger=async()=>okay<{responses:Array<{id:string;payment:{state:string;amount:number};answers:Array<{stepId:string;value:unknown}>}>}>(await f.call(`/api/app/flows/${created.id}/ledger`))
 const publicBefore=(await ledger()).responses.find(row=>row.id===receipt.responseId)!
 expect(publicBefore.payment).toMatchObject({state:'paid',amount:1500})
 await materializeConfirmations(env.DB,new Date().toISOString())
 const confirmation=(await env.DB.prepare('SELECT message_json AS message FROM confirmation_deliveries WHERE response_id=?').bind(receipt.responseId).first<{message:string}>())!
 const token=/\?edit=([a-f0-9]{64})/.exec(JSON.parse(confirmation.message).text)![1]
 expect((await call(`/api/public/flows/${slug}/edit?token=${token}`)).status).toBe(200)
 const refused=await call(`/api/public/flows/${slug}/edit`,{token,answers:[answers[0],{stepId:quantity.id,value:7}]})
 expect(refused.status).toBe(400);expect(await refused.json()).toMatchObject({message:'An edit cannot change the payable total. Payment state has not changed.'})
 expect(await paymentRow()).toEqual(before)
 const unchanged=(await ledger()).responses.find(row=>row.id===receipt.responseId)!
 expect(unchanged.payment).toEqual(publicBefore.payment);expect(unchanged.answers.map(({stepId,value})=>({stepId,value}))).toEqual(expect.arrayContaining(answers))
 expect((await okay<{versions:unknown[]}>(await f.call(`/api/app/responses/${receipt.responseId}/versions`))).versions).toHaveLength(0)
 expect((await call(`/api/public/flows/${slug}/edit?token=${token}`)).status).toBe(200)
 const changed=[{stepId:email.id,value:'synthetic-pencil-paid-edit-updated@example.test'},answers[1]]
 expect(await okay(await call(`/api/public/flows/${slug}/edit`,{token,answers:changed}))).toMatchObject({version:2})
 expect(await paymentRow()).toEqual(before)
 expect((await ledger()).responses.find(row=>row.id===receipt.responseId)!.payment).toEqual(publicBefore.payment)
 expect((await call(`/api/public/flows/${slug}/edit`,{token,answers})).status).toBe(404)
 await okay(await f.call(`/api/app/responses/${receipt.responseId}`,undefined,{method:'DELETE'}),204)
}
