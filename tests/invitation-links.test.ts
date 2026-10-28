import { expect } from 'vitest'
import { contract } from '../src/test/contract'
import { issueLoadTime } from '../src/core/features/traffic/loadTime'
import type { BuilderDraft } from '../src/core/app/api'
import { emittedWorker } from './helpers/emitted-worker.mjs'

contract(["DIST-014","DIST-024"],'emitted invitation answer links are inert for repeated GET and HEAD scanners, pinned to their revision and cannot reopen completed or closed responses',async()=>{
  const origin='https://forms.example.test',relay='https://run.example.test/api/managed-mail/send'
  const bindings={APP_ORIGIN:origin,SEED_ADMIN_EMAIL:'synthetic-pencil-owner@example.test',SESSION_SECRET:'synthetic-pencil-scanner-session-at-least-32-characters',SETUP_TOKEN:'synthetic-pencil-scanner-setup-at-least-32-characters',MAIL_PROVIDER:'rer',MAIL_FROM:'Studio <apps@relay.example.test>',MAIL_RELAY_URL:relay,MAIL_API_KEY:'synthetic-pencil-mail-edge',PENCIL_LOCAL_DEVELOPMENT:'false',SEED_SAMPLE_DATA:'false'}
  const messages:Array<{to:string;text:string;html:string}>=[]
  const runtime=await emittedWorker(bindings,async(request:Request)=>{
    expect(request.url).toBe(relay)
    messages.push(JSON.parse(await request.text()))
    return new Response(null,{status:202})
  })
  try {
    const db=await runtime.getD1Database('DB')
    let cookie='',serial=0
    const request=(path:string,data?:unknown)=>runtime.dispatchFetch(origin+path,{method:data===undefined?'GET':'POST',redirect:'manual',headers:{Host:'forms.example.test',Origin:origin,Cookie:cookie,'content-type':'application/json','CF-Connecting-IP':`192.0.2.${++serial}`},...(data===undefined?{}:{body:JSON.stringify(data)})})
    const json=async<T,>(path:string,data?:unknown):Promise<T>=>{const result=await request(path,data);expect(result.status,path).toBeLessThan(300);return result.json() as Promise<T>}
    const boot=await request('/auth/bootstrap',{token:bindings.SETUP_TOKEN,displayName:'Synthetic owner'})
    expect(boot.status).toBe(303);cookie=boot.headers.get('set-cookie')!.split(';')[0]
    const flow=await json<{id:string}>('/api/app/flows',{title:'Studio recommendation',slug:'synthetic-pencil-email'})
    const path=`/api/app/flows/${flow.id}`,draft=()=>json<BuilderDraft>(`${path}/draft`)
    for(const step of [{kind:'question',questionType:'nps',prompt:'Recommend <Studio>',required:true},{kind:'question',questionType:'short_text',prompt:'What would help?',required:true},{kind:'completion',questionType:null,prompt:'Recorded'}])await json(`${path}/draft/steps`,{expectedVersion:(await draft()).flow.draftVersion,step})
    const published=await draft()
    await json(`${path}/publish`,{expectedVersion:published.flow.draftVersion})
    const contact=await json<{id:string}>('/api/app/distribution/contacts',{name:'Synthetic recipient',email:'synthetic-pencil-reader@example.test'})
    await json(`${path}/distribution`,{contactIds:[contact.id],commandKey:'synthetic-pencil-embedded-invitation'})
    const mail=messages.find(message=>message.to==='synthetic-pencil-reader@example.test')!
    expect(mail).toBeDefined();expect(mail.html).toContain('Recommend &lt;Studio&gt;')
    expect(mail.html).not.toContain('Recommend <Studio>')
    const links=[...mail.text.matchAll(/https?:\/\/[^\s]+\?__pencil_first=\d+/g)].map(match=>match[0])
    expect(links.map(link=>Number(new URL(link).searchParams.get('__pencil_first')))).toEqual(Array.from({length:11},(_,index)=>index))
    const token=new URL(links[0]).pathname.split('/').at(-1)!
    const participant=(await db.prepare('SELECT id,revision_id FROM invitation_participants WHERE token=?').bind(token).first<{id:string;revision_id:string}>())!
    const snapshot=()=>db.prepare(`SELECT p.response_status,
      (SELECT count(*) FROM respondent_sessions WHERE revision_id=p.revision_id) sessions,
      (SELECT count(*) FROM responses WHERE revision_id=p.revision_id) responses,
      (SELECT count(*) FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.revision_id=p.revision_id) answers,
      (SELECT count(*) FROM revision_view_counters WHERE revision_id=p.revision_id) view_rows,
      (SELECT count(*) FROM revision_start_counters WHERE revision_id=p.revision_id) start_rows
      FROM invitation_participants p WHERE p.id=?`).bind(participant.id).first()
    const empty=await snapshot()
    expect(empty).toEqual({response_status:'not-started',sessions:0,responses:0,answers:0,view_rows:0,start_rows:0})
    const scan=(link:string,method:string,index:number)=>runtime.dispatchFetch(link,{method,redirect:'manual',headers:{Host:'forms.example.test','User-Agent':['Synthetic link scanner','Synthetic security preview','Synthetic unknown agent'][index%3],'CF-Connecting-IP':'192.0.2.244'}})
    for(const [index,link] of links.entries())for(const method of ['GET','HEAD','GET']){
      const result=await scan(link,method,index);expect(result.status).toBe(200)
      if(method==='HEAD')expect(await result.text()).toBe('')
    }
    for(const value of ['unknown','-1','11','9&__pencil_first=10'])expect((await scan(`${origin}/i/${token}?__pencil_first=${value}`,'GET',0)).status).toBe(200)
    expect(await snapshot()).toEqual(empty)
    // A later publication does not change the invitation's immutable revision.
    await json(`${path}/publish`,{expectedVersion:(await draft()).flow.draftVersion})
    const session=await json<{sessionId:string;sessionToken:string;revisionId:string}>('/api/public/flows/synthetic-pencil-email/sessions',{source:'direct',deviceClass:'desktop',invitationToken:token})
    expect(session.revisionId).toBe(participant.revision_id)
    await json('/api/public/flows/synthetic-pencil-email/responses',{...session,loadTime:await issueLoadTime(bindings.SESSION_SECRET,session.revisionId,Date.now()-5000),idempotencyKey:'synthetic-pencil-email-completion',invitationToken:token,answers:[{stepId:published.steps[0].id,value:9},{stepId:published.steps[1].id,value:'Clearer setup'}]})
    const completed=await snapshot()
    expect(completed).toMatchObject({response_status:'completed',responses:1,answers:2})
    expect((await scan(links[9],'GET',1)).status).toBe(200)
    expect(await snapshot()).toEqual(completed)
    expect((await request(`${path}/close`,{})).status).toBeLessThan(300)
    expect((await scan(links[9],'GET',2)).status).toBe(200)
    expect(await snapshot()).toEqual(completed)
  } finally {await runtime.dispose()}
},30_000)
