import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { beforeAll,expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { audienceFixture } from './audience-fixture'
import { contactLimits } from '../../src/core/features/distribution/contact-model'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
contract(['AUD-002','AUD-005'],'interrupted launch chunks resume the frozen set after edits and erasure without recreating erased capabilities',async()=>{
  const f=await audienceFixture('audience-chunks'),now=new Date().toISOString()
  const ids=Array.from({length:1200},(_,i)=>String(i).padStart(26,'0'))
  await env.DB.prepare(`INSERT INTO distribution_contacts(id,workspace_id,email,name,created_at,updated_at) SELECT value,?,value||'@chunks.test','Before edit',?,? FROM json_each(?)`).bind(f.scope.workspaceId,now,now,JSON.stringify(ids)).run()
  await env.DB.exec("CREATE TRIGGER interrupt_audience_chunk BEFORE INSERT ON invitation_participants WHEN (SELECT count(*) FROM invitation_participants)>=100 BEGIN SELECT RAISE(ABORT,'synthetic chunk interruption'); END")
  const input={...f.flow,operatorId:f.operatorId,contactIds:ids,commandKey:'interrupted-chunk-command'}
  try { await expect(f.services.distribution.launches.launch(input)).rejects.toThrow('synthetic chunk interruption') }
  finally { await env.DB.exec('DROP TRIGGER interrupt_audience_chunk') }
  const row=await env.DB.prepare('SELECT id,policy_json FROM invitation_launches WHERE command_key=?').bind(input.commandKey).first<{id:string;policy_json:string}>()
  expect(await env.DB.prepare('SELECT count(*) n FROM invitation_participants WHERE launch_id=?').bind(row!.id).first()).toEqual({n:100})
  const pending=(await env.DB.prepare("SELECT contact_id FROM invitation_candidates WHERE launch_id=? AND outcome='pending' ORDER BY id LIMIT 2").bind(row!.id).all<{contact_id:string}>()).results
  await f.services.distribution.contacts.edit(f.scope.workspaceId,pending[0].contact_id,{name:'After edit',email:'after@chunks.test'})
  await f.services.distribution.contacts.erase(f.scope.workspaceId,pending[1].contact_id,f.operatorId)
  let result=await f.services.distribution.launches.launch({...input,contactIds:undefined})
  expect(result.complete).toBe(false)
  const path=`/api/app/flows/${f.flow.flowId}/distribution`
  const history=await (await f.call(path)).json() as {launches:Array<{id:string;commandKey:string;complete:boolean}>}
  expect(history.launches).toContainEqual(expect.objectContaining({id:row!.id,commandKey:input.commandKey,complete:false}))
  const resumed=await f.call(path,'POST',{commandKey:input.commandKey});expect(resumed.status).toBe(201)
  result=await resumed.json() as typeof result
  expect(result.complete).toBe(true);expect(result.counts).toMatchObject({invited:1199,noAddress:1,pending:0})
  expect(await env.DB.prepare('SELECT policy_json FROM invitation_launches WHERE id=?').bind(row!.id).first()).toEqual({policy_json:row!.policy_json})
  expect(await env.DB.prepare('SELECT email_snapshot,name_snapshot FROM invitation_participants WHERE contact_id=?').bind(pending[0].contact_id).first()).toEqual({email_snapshot:pending[0].contact_id+'@chunks.test',name_snapshot:'Before edit'})
  expect(await env.DB.prepare('SELECT id FROM invitation_participants WHERE contact_id=?').bind(pending[1].contact_id).first()).toBeNull()
  const attempts=(await env.DB.prepare('SELECT * FROM mail_delivery_attempts ORDER BY id').all()).results
  expect(await (await f.call(path,'POST',{commandKey:input.commandKey})).json()).toEqual(result)
  expect((await env.DB.prepare('SELECT * FROM mail_delivery_attempts ORDER BY id').all()).results).toEqual(attempts)
  expect(await env.DB.prepare('SELECT count(*) n,count(DISTINCT participant_id) uniqueParticipants FROM mail_deliveries WHERE kind=\'invitation\'').first()).toEqual({n:1199,uniqueParticipants:1199})
},60000)
contract(['AUD-004','AUD-005'],'a full revision audience respects the declared capacity and refuses another launch atomically',async()=>{
  const f=await audienceFixture('audience-capacity'),now=new Date().toISOString(),size=contactLimits.participantsPerRevision
  const ids=Array.from({length:size+1},(_,i)=>'A'+String(i).padStart(25,'0'))
  for(let i=0;i<ids.length;i+=1000) await env.DB.prepare(`INSERT INTO distribution_contacts(id,workspace_id,email,name,created_at,updated_at) SELECT value,?,value||'@capacity.test','Capacity',?,? FROM json_each(?)`).bind(f.scope.workspaceId,now,now,JSON.stringify(ids.slice(i,i+1000))).run()
  const input={...f.flow,operatorId:f.operatorId,contactIds:ids.slice(0,size),commandKey:'capacity-launch-command'}
  let launch=await f.services.distribution.launches.launch(input)
  while(!launch.complete) launch=await f.services.distribution.launches.launch({...input,contactIds:undefined})
  expect(launch.counts.invited).toBe(size)
  const before=(await env.DB.prepare('SELECT * FROM invitation_launches WHERE revision_id=?').bind(launch.revisionId).all()).results
  await expect(f.services.distribution.launches.launch({...input,contactIds:[ids[size]],commandKey:'overflow-launch-command'})).rejects.toThrow('Participant limit reached')
  expect((await env.DB.prepare('SELECT * FROM invitation_launches WHERE revision_id=?').bind(launch.revisionId).all()).results).toEqual(before)
  expect(await env.DB.prepare('SELECT count(*) n FROM invitation_participants WHERE revision_id=?').bind(launch.revisionId).first()).toEqual({n:size})
  expect(await env.DB.prepare('SELECT count(*) n FROM mail_deliveries WHERE participant_id IN(SELECT id FROM invitation_participants WHERE revision_id=?)').bind(launch.revisionId).first()).toEqual({n:size})
  console.log('Audience capacity:',JSON.stringify({selected:size,invited:launch.counts.invited,overflowRefused:true}))
},120000)
