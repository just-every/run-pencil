import { env } from 'cloudflare:test'
import { foundationFixture } from './foundation-fixture'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
export async function notificationFixture(slug:string) {
  const f=await foundationFixture(slug)
  await f.add({kind:'question',questionType:'short_text',prompt:'Feedback',required:true})
  await f.add({kind:'completion',questionType:null,prompt:'Recorded'})
  await f.services.flows.publishDraft({...f.flow,operatorId:f.operatorId,expectedVersion:(await f.draft()).flow.draftVersion})
  const revision=await env.DB.prepare("SELECT id FROM flow_revisions WHERE flow_id=? AND state='published'").bind(f.flow.flowId).first<{id:string}>()
  const question=await env.DB.prepare("SELECT stable_id FROM flow_steps WHERE revision_id=? AND kind='question'").bind(revision!.id).first<{stable_id:string}>()
  const submit=async(quarantine=false)=>{
    const session=await f.start()
    if(!quarantine) await f.mature(session.sessionId)
    await f.final(session,[{stepId:question!.stable_id,value:'DISTINCTIVE-PRIVATE-ANSWER-DO-NOT-MAIL'}])
    const row=await env.DB.prepare('SELECT id,state FROM responses WHERE session_id=?').bind(session.sessionId).first<{id:string;state:string}>()
    return {response:row!,session,replay:()=>f.final(session,[{stepId:question!.stable_id,value:'DISTINCTIVE-PRIVATE-ANSWER-DO-NOT-MAIL'}])}
  }
  const dispatcher=new NotificationDispatcher(env.DB,baseMailSender({kind:'sendgrid',apiKey:'synthetic-secret',from:'no-reply@example.test'},env.DB),'https://forms.example.test','no-reply@example.test')
  const deliveries=()=>f.services.notifications.preferences.read(f.scope.workspaceId,f.flow.flowId,f.operatorId)
  return {...f,submit,deliveries,dispatcher}
}
