import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { RespondentConfirmationDispatcher } from '../../src/core/features/notifications/confirmation-dispatcher'
import { baseMailSender } from '../../src/core/platform/mail/base.server'

declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
contract(['RESP-020','LOGIC-001','FIELD-015','DIST-006','DATA-002'],'released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy',async()=>{
 const f=await foundationFixture('synthetic-pencil-confirmation')
 const post=async<T,>(slug:string,door:string,body:unknown):Promise<T>=>{
  const result=await SELF.fetch(`http://localhost/api/public/flows/${slug}/${door}`,{method:'POST',headers:{Host:'localhost',Origin:'http://localhost','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.61'},body:JSON.stringify(body)})
  expect(result.status,await result.clone().text()).toBe(201)
  return result.json() as Promise<T>
 }
 type Session=Awaited<ReturnType<typeof f.start>>
 const start=(fixture:typeof f,invitationToken?:string)=>post<Session>(fixture.slug,'sessions',{deviceClass:'desktop',source:'direct',invitationToken})
 const final=async(fixture:typeof f,session:Session,answers:Array<{stepId:string;value:unknown}>,honeypot='',invitationToken?:string,hidden?:Record<string,string>)=>post(fixture.slug,'responses',{sessionId:session.sessionId,sessionToken:session.sessionToken,loadTime:await fixture.loadTime(session),idempotencyKey:'key-'+session.sessionId,answers,honeypot,invitationToken,hidden})
 await f.add({kind:'question',questionType:'email',prompt:'Your receipt address',required:true})
 await f.add({kind:'question',questionType:'short_text',prompt:'Feedback',required:true})
 await f.add({kind:'question',questionType:'short_text',prompt:'Optional note',required:false})
 await f.add({kind:'question',questionType:'date',prompt:'Visit date',required:true,questionSettings:{displayFormat:'MM/DD/YYYY'}})
 await f.add({kind:'question',questionType:'number',prompt:'Party size',required:true})
 await f.add({kind:'completion',questionType:null,prompt:'Recorded'})
 const draft=await f.draft(),[email,text,skipped,date,number]=draft.steps
 const settings={...draft.formSettings!,hiddenFields:[{id:'campaign',name:'campaign',type:'text' as const,category:'plain' as const}],calculations:[{id:'double',name:'Double',type:'number' as const,expression:{kind:'multiply' as const,left:{kind:'answer' as const,stepId:number.id},right:{kind:'literal' as const,value:2}}}],confirmation:{enabled:true,includeAnswers:true,answerTypes:['short_text','date','number'],emailStepId:email.id,subject:`Received {{${text.id}}}`,body:`Answer {{${text.id}}}; hidden {{hidden:campaign}}; calculated {{variable:double}}; skipped [{{${skipped.id}}}]`}}
 await f.services.flows.updateFormSettings({...f.flow,expectedVersion:draft.flow.draftVersion,settings})
 expect(await f.publish()).toMatchObject({kind:'published'})
 const submit=async(options:{immature?:boolean;honeypot?:string;token?:string;mailbox?:string}={})=>{
  const session=await start(f,options.token)
  if(!options.immature)await f.mature(session.sessionId)
  await final(f,session,[{stepId:email.id,value:options.mailbox??'synthetic-pencil-receipt@example.test'},{stepId:text.id,value:'<script>alert(1)</script> {{hidden:campaign}}'},{stepId:date.id,value:'2026-07-04'},{stepId:number.id,value:3}],options.honeypot??'',options.token,{campaign:'Synthetic <campaign>'})
  return {session,row:await env.DB.prepare('SELECT id,state FROM responses WHERE session_id=?').bind(session.sessionId).first<{id:string;state:string}>()}
 }
 const sent:Array<any>=[]
 const network=vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{const message=JSON.parse(String(init?.body));sent.push(message);return new Response(null,{status:sent.length===1?429:202})})
 const dispatcher=new RespondentConfirmationDispatcher(env.DB,baseMailSender({kind:'sendgrid',apiKey:'synthetic-pencil-mail-edge',from:'receipts@example.test'},env.DB),'receipts@example.test')
 try {
  const completed=await submit(),now=Date.now()
  await dispatcher.run(new Date(now).toISOString())
  expect(await env.DB.prepare('SELECT status,attempts FROM confirmation_deliveries WHERE response_id=?').bind(completed.row!.id).first()).toEqual({status:'pending',attempts:1})
  await dispatcher.run(new Date(now+60_000).toISOString());await dispatcher.run(new Date(now+120_000).toISOString())
  expect(sent).toHaveLength(2)
  expect(new Set(sent.map(message=>message.custom_args.rer_delivery_id)).size).toBe(1)
  const message=sent[1],html=message.content.find((part:any)=>part.type==='text/html').value,plain=message.content.find((part:any)=>part.type==='text/plain').value
  expect(message.personalizations[0].to).toEqual([{email:'synthetic-pencil-receipt@example.test'}])
  expect(message.headers).not.toHaveProperty('Reply-To')
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; {{hidden:campaign}}');expect(html).not.toContain('<script>')
  expect(plain).toContain('hidden Synthetic <campaign>');expect(html).toContain('hidden Synthetic &lt;campaign&gt;')
  expect(plain).toContain('calculated 6');expect(plain).toContain('skipped []');expect(plain).toContain('07/04/2026')
  expect(plain).not.toContain('2026-07-04');expect(plain).not.toContain('/app/');expect(plain).not.toContain('/response')
  await final(f,completed.session,[{stepId:email.id,value:'synthetic-pencil-receipt@example.test'},{stepId:text.id,value:'<script>alert(1)</script> {{hidden:campaign}}'},{stepId:date.id,value:'2026-07-04'},{stepId:number.id,value:3}]);await dispatcher.run()
  expect(sent).toHaveLength(2)
  for(const [options,before,after] of [[{immature:true},2,3],[{honeypot:'scanner'},3,4]] as const){
   const held=await submit(options);expect(held.row!.state).toBe('quarantined');await dispatcher.run();expect(sent).toHaveLength(before)
   expect(await env.DB.prepare('SELECT id FROM confirmation_deliveries WHERE response_id=?').bind(held.row!.id).first()).toBeNull()
   await f.services.responses.releaseQuarantinedResponse({...f.scope,responseId:held.row!.id,operatorId:f.operatorId});await dispatcher.run();expect(sent).toHaveLength(after)
  }
  const noQuestion=await foundationFixture('synthetic-pencil-no-confirmation-address')
  await noQuestion.add({kind:'question',questionType:'short_text',prompt:'Feedback',required:true});await noQuestion.add({kind:'completion',questionType:null,prompt:'Recorded'})
  const noDraft=await noQuestion.draft()
  await noQuestion.services.flows.updateFormSettings({...noQuestion.flow,expectedVersion:noDraft.flow.draftVersion,settings:{...noDraft.formSettings!,confirmation:{enabled:true,includeAnswers:false,answerTypes:[],subject:'Response receipt',body:'Thank you.'}}});await noQuestion.publish()
  const noSession=await start(noQuestion);await noQuestion.mature(noSession.sessionId);await final(noQuestion,noSession,[{stepId:noDraft.steps[0].id,value:'Anonymous feedback'}]);await dispatcher.run()
  expect(sent).toHaveLength(4)
  const contact=await noQuestion.services.distribution.contacts.save(noQuestion.scope.workspaceId,{name:'Synthetic participant',email:'synthetic-pencil-participant@example.test'}) as {id:string}
  await noQuestion.services.distribution.launches.launch({...noQuestion.flow,operatorId:noQuestion.operatorId,contactIds:[contact.id],commandKey:'synthetic-pencil-confirmation-participant'})
  const invitation=(await env.DB.prepare('SELECT token FROM invitation_participants WHERE contact_id=? AND revision_id=?').bind(contact.id,noSession.revisionId).first<{token:string}>())!
  const identified=await start(noQuestion,invitation.token);await noQuestion.mature(identified.sessionId)
  await final(noQuestion,identified,[{stepId:noDraft.steps[0].id,value:'Identified feedback'}],'',invitation.token);await dispatcher.run()
  expect(sent).toHaveLength(5);expect(sent.at(-1).personalizations[0].to).toEqual([{email:'synthetic-pencil-participant@example.test'}])
  const opted=await noQuestion.services.distribution.contacts.save(noQuestion.scope.workspaceId,{name:'Synthetic opted out',email:'synthetic-pencil-opted@example.test'}) as {id:string}
  await noQuestion.services.distribution.launches.launch({...noQuestion.flow,operatorId:noQuestion.operatorId,contactIds:[opted.id],commandKey:'synthetic-pencil-confirmation-opted'})
  const optedInvite=(await env.DB.prepare('SELECT token,opt_out_token AS optOutToken FROM invitation_participants WHERE contact_id=?').bind(opted.id).first<{token:string;optOutToken:string}>())!
  const optedSession=await start(noQuestion,optedInvite.token);await noQuestion.mature(optedSession.sessionId)
  await final(noQuestion,optedSession,[{stepId:noDraft.steps[0].id,value:'Consented collection'}],'',optedInvite.token)
  await noQuestion.services.distribution.contacts.optOut(optedInvite.optOutToken)
  await dispatcher.run();expect(sent).toHaveLength(5)

  const suppressed=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:'Synthetic suppressed recipient',email:'synthetic-pencil-suppressed@example.test'}) as {id:string}
  await f.services.distribution.launches.launch({...f.flow,operatorId:f.operatorId,contactIds:[suppressed.id],commandKey:'synthetic-pencil-suppressed-confirmation'})
  const suppressedInvite=(await env.DB.prepare('SELECT opt_out_token AS token FROM invitation_participants WHERE contact_id=?').bind(suppressed.id).first<{token:string}>())!
  await f.services.distribution.contacts.optOut(suppressedInvite.token)
  const blocked=await submit({mailbox:'SYNTHETIC-PENCIL-SUPPRESSED@example.test'});await dispatcher.run()
  expect(sent).toHaveLength(5)
  expect(await env.DB.prepare('SELECT status FROM confirmation_deliveries WHERE response_id=?').bind(blocked.row!.id).first()).toEqual({status:'cancelled'})
  const bounced=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:'Synthetic bounced recipient',email:'synthetic-pencil-bounced@example.test'}) as {id:string}
  await f.services.distribution.launches.launch({...f.flow,operatorId:f.operatorId,contactIds:[bounced.id],commandKey:'synthetic-pencil-bounced-confirmation'})
  await env.DB.prepare("UPDATE invitation_participants SET delivery_status='bounced' WHERE contact_id=?").bind(bounced.id).run()
  const bouncedResponse=await submit({mailbox:'SYNTHETIC-PENCIL-BOUNCED@example.test'});await dispatcher.run()
  expect(sent).toHaveLength(5)
  expect(await env.DB.prepare('SELECT status FROM confirmation_deliveries WHERE response_id=?').bind(bouncedResponse.row!.id).first()).toEqual({status:'cancelled'})
  await f.services.responses.eraseReleasedResponse({...f.scope,responseId:completed.row!.id,operatorId:f.operatorId})
  expect(await env.DB.prepare('SELECT id FROM confirmation_deliveries WHERE response_id=?').bind(completed.row!.id).first()).toBeNull()
  expect((await env.DB.prepare("SELECT id FROM confirmation_attempts WHERE delivery_id=?").bind('confirmation:'+completed.row!.id).all()).results).toHaveLength(0)
 }finally{network.mockRestore()}
})
