import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { RespondentConfirmationDispatcher } from '../../src/core/features/notifications/confirmation-dispatcher'
import { baseMailSender } from '../../src/core/platform/mail/base.server'

declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
contract(['RESP-020','LOGIC-001','FIELD-015','DIST-006','DATA-002'],'released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy',async()=>{
 const f=await foundationFixture('synthetic-pencil-confirmation')
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
  const session=await f.services.responses.startPublicSession({slug:f.slug,deviceClass:'desktop',source:'direct',clientAddress:'synthetic-pencil-confirmation',...(options.token?{invitationToken:options.token}:{})})
  if(!options.immature)await f.mature(session.sessionId)
  await f.services.responses.submitPublicResponse({slug:f.slug,sessionId:session.sessionId,sessionToken:session.sessionToken,loadTime:await f.loadTime(session),idempotencyKey:'key-'+session.sessionId,clientAddress:'synthetic-pencil-confirmation',hidden:{campaign:'Synthetic <campaign>'},answers:[{stepId:email.id,value:options.mailbox??'synthetic-pencil-receipt@example.test'},{stepId:text.id,value:'<script>alert(1)</script> {{hidden:campaign}}'},{stepId:date.id,value:'2026-07-04'},{stepId:number.id,value:3}],honeypot:options.honeypot??'',invitationToken:options.token})
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
  await f.final(completed.session,[{stepId:email.id,value:'synthetic-pencil-receipt@example.test'},{stepId:text.id,value:'<script>alert(1)</script> {{hidden:campaign}}'},{stepId:date.id,value:'2026-07-04'},{stepId:number.id,value:3}]);await dispatcher.run()
  expect(sent).toHaveLength(2)
  for(const options of [{immature:true},{honeypot:'scanner'}]){
   const held=await submit(options);expect(held.row!.state).toBe('quarantined');await dispatcher.run();expect(sent).toHaveLength(2)
   expect(await env.DB.prepare('SELECT id FROM confirmation_deliveries WHERE response_id=?').bind(held.row!.id).first()).toBeNull()
   await f.services.responses.releaseQuarantinedResponse({...f.scope,responseId:held.row!.id,operatorId:f.operatorId});await dispatcher.run();expect(sent).toHaveLength(options.immature?3:4)
  }
  const noQuestion=await foundationFixture('synthetic-pencil-no-confirmation-address')
  await noQuestion.add({kind:'question',questionType:'short_text',prompt:'Feedback',required:true});await noQuestion.add({kind:'completion',questionType:null,prompt:'Recorded'})
  const noDraft=await noQuestion.draft()
  await noQuestion.services.flows.updateFormSettings({...noQuestion.flow,expectedVersion:noDraft.flow.draftVersion,settings:{...noDraft.formSettings!,confirmation:{enabled:true,includeAnswers:false,answerTypes:[],subject:'Response receipt',body:'Thank you.'}}});await noQuestion.publish()
  const noSession=await noQuestion.start();await noQuestion.mature(noSession.sessionId);await noQuestion.final(noSession,[{stepId:noDraft.steps[0].id,value:'Anonymous feedback'}]);await dispatcher.run()
  expect(sent).toHaveLength(4)
  const contact=await noQuestion.services.distribution.contacts.save(noQuestion.scope.workspaceId,{name:'Synthetic participant',email:'synthetic-pencil-participant@example.test'}) as {id:string}
  await noQuestion.services.distribution.launches.launch({...noQuestion.flow,operatorId:noQuestion.operatorId,contactIds:[contact.id],commandKey:'synthetic-pencil-confirmation-participant'})
  const invitation=(await env.DB.prepare('SELECT token FROM invitation_participants WHERE contact_id=? AND revision_id=?').bind(contact.id,noSession.revisionId).first<{token:string}>())!
  const identified=await noQuestion.services.responses.startPublicSession({slug:noQuestion.slug,deviceClass:'desktop',source:'direct',invitationToken:invitation.token});await noQuestion.mature(identified.sessionId)
  await noQuestion.final(identified,[{stepId:noDraft.steps[0].id,value:'Identified feedback'}],'',invitation.token);await dispatcher.run()
  expect(sent).toHaveLength(5);expect(sent.at(-1).personalizations[0].to).toEqual([{email:'synthetic-pencil-participant@example.test'}])
  const opted=await noQuestion.services.distribution.contacts.save(noQuestion.scope.workspaceId,{name:'Synthetic opted out',email:'synthetic-pencil-opted@example.test'}) as {id:string}
  await noQuestion.services.distribution.launches.launch({...noQuestion.flow,operatorId:noQuestion.operatorId,contactIds:[opted.id],commandKey:'synthetic-pencil-confirmation-opted'})
  const optedInvite=(await env.DB.prepare('SELECT token,opt_out_token AS optOutToken FROM invitation_participants WHERE contact_id=?').bind(opted.id).first<{token:string;optOutToken:string}>())!
  const optedSession=await noQuestion.services.responses.startPublicSession({slug:noQuestion.slug,deviceClass:'desktop',source:'direct',invitationToken:optedInvite.token});await noQuestion.mature(optedSession.sessionId)
  await noQuestion.final(optedSession,[{stepId:noDraft.steps[0].id,value:'Consented collection'}],'',optedInvite.token)
  await noQuestion.services.distribution.contacts.optOut(optedInvite.optOutToken)
  await dispatcher.run();expect(sent).toHaveLength(5)

  const suppressed=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:'Synthetic suppressed recipient',email:'synthetic-pencil-suppressed@example.test'}) as {id:string}
  await f.services.distribution.launches.launch({...f.flow,operatorId:f.operatorId,contactIds:[suppressed.id],commandKey:'synthetic-pencil-suppressed-confirmation'})
  const suppressedInvite=(await env.DB.prepare('SELECT opt_out_token AS token FROM invitation_participants WHERE contact_id=?').bind(suppressed.id).first<{token:string}>())!
  await f.services.distribution.contacts.optOut(suppressedInvite.token)
  const blocked=await submit({mailbox:'SYNTHETIC-PENCIL-SUPPRESSED@example.test'});await dispatcher.run()
  expect(sent).toHaveLength(5)
  expect(await env.DB.prepare("SELECT id FROM confirmation_deliveries WHERE response_id=? AND status='sent'").bind(blocked.row!.id).first()).toBeNull()
  await f.services.responses.eraseReleasedResponse({...f.scope,responseId:completed.row!.id,operatorId:f.operatorId})
  expect(await env.DB.prepare('SELECT id FROM confirmation_deliveries WHERE response_id=?').bind(completed.row!.id).first()).toBeNull()
  expect((await env.DB.prepare("SELECT id FROM confirmation_attempts WHERE delivery_id=?").bind('confirmation:'+completed.row!.id).all()).results).toHaveLength(0)
 }finally{network.mockRestore()}
})
