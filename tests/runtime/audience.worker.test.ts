import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { audienceFixture as fixture } from './audience-fixture'
import { InvitationLaunches } from '../../src/core/features/distribution/launches'
import { distributionPolicies } from '../../src/ext/config'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const contacts='/api/app/distribution/contacts',segments='/api/app/distribution/segments'
contract(['AUD-001','BASE-INPUT-001','BASE-INPUT-003'], 'audience CSV public preview and commit report case matches, repeats, invalid rows and explicit updates without retaining raw CSV',async()=>{
  const f=await fixture('audience-csv')
  const before=(await (await f.call(contacts)).json() as unknown[]).length
  const created=await f.call(contacts,'POST',{name:'Original',email:'Existing@example.test',fields:{team:'old'}});expect(created.status).toBe(201)
  const contact=await created.json() as {id:string}
  expect((await f.call(contacts,'POST',{name:'No overwrite',email:'EXISTING@example.test'})).status).toBe(409)
  const csv='name,email,team\nExisting update,EXISTING@example.test,new\nNew,new@example.test,blue\nRepeat,NEW@example.test,green\nBad,not-an-email,red\nMissing,,red\nToo long,long@example.test,'+'x'.repeat(501)
  const preview=await f.call(contacts+'/import','POST',{csv});expect(preview.status).toBe(200)
  const report=await preview.json() as {rows:Array<{row:number;status:string;match?:string}>;counts:unknown;committed:boolean}
  expect(report.counts).toEqual({added:1,matched:2,updated:0,invalid:2,overLimit:1})
  expect(report.rows.map(r=>[r.row,r.status,r.match??null])).toEqual([[2,'matched','existing'],[3,'added',null],[4,'matched','file'],[5,'invalid',null],[6,'invalid',null],[7,'over-limit',null]])
  expect((await (await f.call(contacts)).json() as unknown[])).toHaveLength(before+1)
  expect(await (await f.call(contacts+'/import','POST',{csv,commit:true})).json()).toEqual({...report,committed:true})
  expect((await (await f.call(contacts)).json() as unknown[])).toHaveLength(before+2)
  const updated=await (await f.call(contacts+'/import','POST',{csv,commit:true,updateMatches:true})).json() as {counts:unknown}
  expect(updated.counts).toEqual({added:0,matched:0,updated:3,invalid:2,overLimit:1})
  const rows=await (await f.call(contacts)).json() as Array<{id:string;name:string;fields:unknown}>
  expect(rows.find(c=>c.id===contact.id)).toMatchObject({name:'Existing update',fields:{team:'new'}})
  expect((await f.call(`${contacts}/${contact.id}`,'PUT',{name:'Conflict',email:'NEW@example.test'})).status).toBe(409)
  expect((await f.call(contacts+'/import','POST',{csv:'name,email\n'+Array.from({length:5001},(_,i)=>`N,n${i}@example.test`).join('\n'),commit:true})).status).toBe(400)
  expect((await f.call(contacts+'/import','POST',{csv:'x'.repeat(2097153)})).status).toBe(400)
  expect((await f.call(contacts,'POST',{name:'Invalid fields',email:'fields@example.test',fields:Object.fromEntries(Array.from({length:21},(_,i)=>['k'+i,'v']))})).status).toBe(400)
  const audit=(await env.DB.prepare("SELECT details_json,subject_id FROM audit_entries WHERE kind='contacts.imported'").all()).results
  expect(audit).toHaveLength(2);expect(JSON.stringify(audit)).not.toMatch(/Existing|example.test|team|green/)
  const prior=(await env.DB.prepare('SELECT * FROM distribution_contacts ORDER BY id').all()).results
  await env.DB.exec("CREATE TRIGGER fail_audience_import BEFORE INSERT ON distribution_contacts WHEN NEW.email='fail-import@example.test' BEGIN SELECT RAISE(ABORT,'synthetic import failure'); END")
  try {
    expect((await f.call(contacts+'/import','POST',{csv:'name,email\nFirst,first-import@example.test\nFail,fail-import@example.test',commit:true})).status).toBe(500)
    expect((await env.DB.prepare('SELECT * FROM distribution_contacts ORDER BY id').all()).results).toEqual(prior)
    expect((await env.DB.prepare("SELECT details_json,subject_id FROM audit_entries WHERE kind='contacts.imported'").all()).results).toEqual(audit)
  } finally { await env.DB.exec('DROP TRIGGER fail_audience_import') }
  const bulk='name,email,cohort\n'+Array.from({length:5000},(_,i)=>`Bulk ${i},bulk-${i}@import.test,batch`).join('\n')
  const imported=await f.call(contacts+'/import','POST',{csv:bulk,commit:true});expect(imported.status).toBe(200)
  expect(await imported.json()).toMatchObject({counts:{added:5000,matched:0,invalid:0,overLimit:0}})
  expect((await (await f.call(contacts+'?q=bulk-&offset=0&limit=250')).json() as unknown[])).toHaveLength(250)
  expect((await (await f.call(contacts+'?q=bulk-4999&offset=0&limit=250')).json() as Array<{email:string}>).map(c=>c.email)).toEqual(['bulk-4999@import.test'])
  expect((await f.call(contacts+'?limit=1001')).status).toBe(400)


},60000)
contract(['AUD-002','AUD-004','AUD-005'],'saved segments launch a frozen evaluated audience and concurrent command replay creates no extra participants, jobs or attempts',async()=>{
  const f=await fixture('audience-segments')
  const a=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:'A',email:'a@audience.test',fields:{team:'blue'}})
  const b=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:'B',email:'b@audience.test',fields:{team:'blue'}})
  await f.services.distribution.contacts.consent({...f.scope,contactId:b.id,actor:f.operatorId,source:'Operator request',renewed:false})
  const response=await f.call(segments,'POST',{name:'Blue',rules:[{field:'custom',key:'team',operator:'is',value:'blue'}]});expect(response.status).toBe(201)
  const segment=await response.json() as {id:string;matchCount:number};expect(segment.matchCount).toBe(2)
  for(const field of ['name','custom','emailDomain']) expect((await f.call(segments,'POST',{name:'Forbidden',rules:[{field,key:'email',operator:'is',value:'a@audience.test'}]})).status).toBe(400)
  const path=`/api/app/flows/${f.flow.flowId}/distribution`,body={segmentId:segment.id,commandKey:'segment-launch-command'}
  const replies=await Promise.all([f.call(path,'POST',body),f.call(path,'POST',body)])
  for(const reply of replies) expect(reply.status).toBe(201)
  const launch=await replies[0].json() as {id:string;counts:unknown};expect(launch.counts).toMatchObject({invited:1,optedOut:1,pending:0})
  const saved=await env.DB.prepare('SELECT policy_json FROM invitation_launches WHERE id=?').bind(launch.id).first()
  const before=(await env.DB.prepare('SELECT * FROM invitation_participants WHERE launch_id=?').bind(launch.id).all()).results
  const attempts=(await env.DB.prepare('SELECT * FROM mail_delivery_attempts ORDER BY id').all()).results
  await f.call(`${segments}/${segment.id}`,'PUT',{name:'Green',rules:[{field:'custom',key:'team',operator:'is',value:'green'}]})
  await f.call(`${contacts}/${a.id}`,'PUT',{name:'Edited',email:'edited@audience.test',fields:{team:'green'}})
  expect((await f.call(path,'POST',body)).status).toBe(201)
  expect(await env.DB.prepare('SELECT policy_json FROM invitation_launches WHERE id=?').bind(launch.id).first()).toEqual(saved)
  expect((await env.DB.prepare('SELECT * FROM invitation_participants WHERE launch_id=?').bind(launch.id).all()).results).toEqual(before)
  expect((await env.DB.prepare('SELECT * FROM mail_delivery_attempts ORDER BY id').all()).results).toEqual(attempts)
  const narrowed=new InvitationLaunches(env.DB,{...distributionPolicies,'flow.audience-eligibility.v1':{excludePreviouslyInvitedToFlow:true}})
  await f.publish()
  const result=await narrowed.launch({...f.flow,operatorId:f.operatorId,contactIds:[a.id,b.id],commandKey:'narrowed-launch-command'})
  expect(result.counts).toMatchObject({invited:0,policyExcluded:1,optedOut:1})
  expect((await f.call(`${segments}/${segment.id}`,'DELETE')).status).toBe(204)
},60000)
contract(['AUD-001','BASE-ACCESS-004','BASE-DATA-003'],'audience mutations enforce session, origin, workspace, confirmation and return completed anonymous erasure receipts',async()=>{
  const f=await fixture('audience-erasure')
  const contact=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:'Erase canary',email:'erase-canary@example.test',fields:{canary:'erase-field-canary'}})
  const path=`${contacts}/${contact.id}/erase`
  expect((await f.call(path,'POST',{confirm:true},false)).status).toBe(401)
  expect((await f.call(path,'POST',{})).status).toBe(400)
  expect((await f.call(path,'POST',{confirm:true},true,'https://other.test')).status).toBe(403)
  expect((await f.call(`${contacts}/01K00000000000000000000000/erase`,'POST',{confirm:true})).status).toBe(404)
  const now=new Date().toISOString(),foreign='01K00000000000000000000001'
  await env.DB.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)').bind(foreign,'Other','UTC',now,now).run()
  const other=await f.services.distribution.contacts.save(foreign,{name:'Other',email:'other@example.test'})
  expect((await f.call(`${contacts}/${other.id}/erase`,'POST',{confirm:true})).status).toBe(404)
  expect((await f.call(`${contacts}/${other.id}`,'PUT',{name:'Hijack',email:'hijack@example.test'})).status).toBe(404)
  expect(await env.DB.prepare('SELECT fields_json FROM distribution_contacts WHERE id=?').bind(contact.id).first()).toEqual({fields_json:'{"canary":"erase-field-canary"}'})
  const erased=await f.call(path,'POST',{confirm:true});expect(erased.status).toBe(200)
  expect(await erased.json()).toMatchObject({completed:true,counts:{contacts:1,participants:0,responses:0},elapsedMilliseconds:expect.any(Number)})
  expect((await f.call(path,'POST',{confirm:true})).status).toBe(404)
  expect((await env.DB.prepare("SELECT subject_id FROM audit_entries WHERE kind='contact.erased'").all()).results).toEqual([{subject_id:null}])
},60000)
contract('AUD-006','contact editing and explicit CSV updates keep snapshot addresses; invitation and reminder sends recheck deletion and opt-out',async()=>{
  const f=await fixture('audience-send-time')
  await f.services.workspace.updateSettings({...f.scope,timeZone:'UTC',sendingWindowStart:'00:00',sendingWindowEnd:'23:59',reminderDelayHours:0})
  const contact=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:'Original',email:'snapshot@send.test'})
  const launch=await f.services.distribution.launches.launch({...f.flow,operatorId:f.operatorId,contactIds:[contact.id],commandKey:'snapshot-send-command'})
  await f.call(`${contacts}/${contact.id}`,'PUT',{name:'Edited',email:'edited@send.test'})
  await f.call(contacts+'/import','POST',{csv:'name,email,team\nImported,EDITED@send.test,green',commit:true,updateMatches:true})
  const p=await env.DB.prepare('SELECT id FROM invitation_participants WHERE launch_id=?').bind(launch.id).first<{id:string}>()
  const invitation=await env.DB.prepare("SELECT id FROM mail_deliveries WHERE participant_id=? AND kind='invitation'").bind(p!.id).first<{id:string}>()
  expect(await f.services.distribution.deliveries.prepare(invitation!.id,'http://localhost')).toMatchObject({to:'snapshot@send.test'})
  await f.services.distribution.deliveries.record(invitation!.id,1,{kind:'sent',providerId:'synthetic'})
  const reminder=await env.DB.prepare("SELECT id FROM mail_deliveries WHERE participant_id=? AND kind='reminder'").bind(p!.id).first<{id:string}>()
  expect(await f.services.distribution.deliveries.prepare(reminder!.id,'http://localhost','2099-01-01T12:00:00.000Z')).toMatchObject({to:'snapshot@send.test'})
  for(const kind of ['invitation','reminder']) for(const action of ['opt-out','erase']) {
    const c=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:kind,email:`${kind}-${action}@send.test`})
    const l=await f.services.distribution.launches.launch({...f.flow,operatorId:f.operatorId,contactIds:[c.id],commandKey:`send-guard-${kind}-${action}`})
    const participant=await env.DB.prepare('SELECT id FROM invitation_participants WHERE launch_id=?').bind(l.id).first<{id:string}>()
    if(kind==='reminder') {
      const d=await env.DB.prepare("SELECT id FROM mail_deliveries WHERE participant_id=? AND kind='invitation'").bind(participant!.id).first<{id:string}>()
      await f.services.distribution.deliveries.prepare(d!.id,'http://localhost');await f.services.distribution.deliveries.record(d!.id,1,{kind:'sent',providerId:'synthetic'})
    }
    if(action==='erase') expect((await f.call(`${contacts}/${c.id}/erase`,'POST',{confirm:true})).status).toBe(200)
    else expect((await f.call(`${contacts}/${c.id}/consent`,'POST',{renewed:false,source:'Operator recorded withdrawal'})).status).toBe(204)
    const d=await env.DB.prepare('SELECT id FROM mail_deliveries WHERE participant_id=? AND kind=?').bind(participant!.id,kind).first<{id:string}>()
    const attempts=(await env.DB.prepare('SELECT * FROM mail_delivery_attempts WHERE delivery_id=?').bind(d!.id).all()).results
    expect(await f.services.distribution.deliveries.prepare(d!.id,'http://localhost','2099-01-01T12:00:00.000Z')).toBeNull()
    expect((await env.DB.prepare('SELECT * FROM mail_delivery_attempts WHERE delivery_id=?').bind(d!.id).all()).results).toEqual(attempts)
  }
},60000)

contract(['AUD-005','BASE-ACCESS-004'],'competing flows cannot reuse a launch command to advance or return another flow audience',async()=>{
  const first=await fixture('audience-command-first'),second=await fixture('audience-command-second')
  const contact=await first.services.distribution.contacts.save(first.scope.workspaceId,{name:'Competition',email:'competition@audience.test'})
  const paths=[first,second].map(f=>`/api/app/flows/${f.flow.flowId}/distribution`)
  const body={contactIds:[contact.id],commandKey:'competing-flow-command'}
  const replies=await Promise.all(paths.map(path=>first.call(path,'POST',body)))
  expect(replies.map(r=>r.status).sort()).toEqual([201,400])
  const winner=replies.findIndex(r=>r.status===201),loser=1-winner
  const launch=await replies[winner].json() as {id:string;revisionId:string;counts:{invited:number}}
  expect(launch.counts.invited).toBe(1)
  expect((await first.call(paths[loser],'POST',{commandKey:body.commandKey})).status).toBe(400)
  expect(await env.DB.prepare('SELECT r.flow_id FROM invitation_launches l JOIN flow_revisions r ON r.id=l.revision_id WHERE l.command_key=?').bind(body.commandKey).first()).toEqual({flow_id:[first,second][winner].flow.flowId})
  expect(await env.DB.prepare('SELECT count(*) n FROM invitation_launches WHERE command_key=?').bind(body.commandKey).first()).toEqual({n:1})
  expect(await env.DB.prepare('SELECT count(*) n FROM invitation_participants WHERE launch_id=? AND revision_id=?').bind(launch.id,launch.revisionId).first()).toEqual({n:1})
  expect(await env.DB.prepare("SELECT count(*) n FROM mail_deliveries WHERE kind='invitation' AND participant_id IN(SELECT id FROM invitation_participants WHERE launch_id=?)").bind(launch.id).first()).toEqual({n:1})
  expect((await env.DB.prepare('SELECT delivery_id,ordinal,event,count(*) n FROM mail_delivery_attempts GROUP BY delivery_id,ordinal,event').all<{n:number}>()).results.every(row=>row.n===1)).toBe(true)
  expect((await first.call(paths[loser])).status).toBe(200)
  expect(await (await first.call(paths[loser])).json()).toMatchObject({launches:[],participants:[]})
})
