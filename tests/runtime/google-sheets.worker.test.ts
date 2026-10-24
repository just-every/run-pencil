import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { beforeAll,expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { actionsHttp,everyStoredValue } from './actions-fixture'
import { matureLoad } from './load-time-fixture'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const receiver=(env as unknown as {TASK_RECEIVER_ORIGIN:string}).TASK_RECEIVER_ORIGIN
contract(['INTEG-001','INTEG-015'],'Google OAuth seals owner tokens and Sheets backfills, appends stable columns, replays failed rows without duplicates and clears an erased response',async()=>{
 await fetch(receiver+'/__control/reset',{method:'POST',body:'{}'})
 const f=await actionsHttp({},'sheets-'+crypto.randomUUID().slice(0,8)),base=`/api/app/flows/${f.flowId}`,book='synthetic-pencil-1'
 const accepted=async(response:Response,status=200)=>{expect(response.status,'Google proof HTTP status').toBe(status);return response.status===204?undefined:response.json() as Promise<any>}
 const config={clientId:'synthetic-pencil-2',clientSecret:'synthetic-pencil-google-secret',authOrigin:receiver,tokenOrigin:receiver,apiOrigin:receiver}
 await env.DB.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").bind(f.lead.operatorId).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
 expect((await f.call('/api/app/connections/google/start',config)).status).toBe(403)
 await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.lead.operatorId).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
 const start=await accepted(await f.call('/api/app/connections/google/start',config)),authorization=new URL(start.authorizationUrl)
 expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');expect(authorization.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
 const grant=await fetch(authorization.href,{redirect:'manual'});expect(grant.status).toBe(302)
 const callback=new URL(grant.headers.get('location')!)
 expect((await f.as(f.owner.token)(callback.pathname+callback.search)).status).toBe(403)
 expect((await f.call(callback.pathname+callback.search)).status).toBe(303)
 expect((await f.call(callback.pathname+callback.search)).status).toBe(403)
 const status=await accepted(await f.call('/api/app/connections/google'));expect(status).toMatchObject({connected:true})
 const audit=await accepted(await f.call('/api/app/audit?kind=connection.saved'));expect(audit.rows.some((row:any)=>row.details.connection==='google')).toBe(true)
 expect((await f.call(base+'/google-sheet',{spreadsheetId:book,tab:'Synthetic responses'},{method:'PUT'})).status).toBe(400)
 const readDraft=async()=>accepted(await f.call(base+'/draft'))
 let current=await readDraft()
 await accepted(await f.call(base+'/draft/settings',{expectedVersion:current.flow.draftVersion,settings:{...current.formSettings,googleSheets:true}},{method:'PUT'}))
 await accepted(await f.call(base+'/publish',{expectedVersion:(await readDraft()).flow.draftVersion}),201)
 const slug=(await readDraft()).flow.slug
 const submit=async(n:number)=>{
  const session=await accepted(await f.call(`/api/public/flows/${slug}/sessions`,{source:'direct',deviceClass:'desktop'}),201);await matureLoad(session,5000)
  const graph=session.flow,answers=graph.steps.filter((step:any)=>step.kind==='question').map((step:any)=>({stepId:step.id,value:step.questionType==='single_choice'?graph.choices.find((choice:any)=>choice.stepId===step.id).id:`Synthetic sheet row ${n}`}))
  const result=await accepted(await f.call(`/api/public/flows/${slug}/responses`,{...session,answers,idempotencyKey:`synthetic-pencil-${n}`,honeypot:''}),201)
  expect(result.disposition).toBe('released');return result.responseId as string
 }
 const first=[] as string[];for(let n=1;n<=3;n++)first.push(await submit(n))
 const tabs=await accepted(await f.call('/api/app/connections/google/worksheets?spreadsheetId='+book));expect(tabs.worksheets).toContainEqual({title:'Synthetic responses',id:1})
 await accepted(await f.call(base+'/google-sheet',{spreadsheetId:book,tab:'Synthetic responses'},{method:'PUT'}))
 const sheet=async()=>((await (await fetch(receiver+'/__control/state')).json()) as {sheets:Record<string,string[][]>}).sheets[book]??[]
 expect((await sheet()).filter(row=>row[0])).toHaveLength(4)
 const oldHeader=(await sheet())[0]
 const fourth=await submit(4)
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 expect((await sheet()).filter(row=>row[0])).toHaveLength(5)
 current=await readDraft()
 await accepted(await f.call(base+'/draft/steps',{expectedVersion:current.flow.draftVersion,step:{kind:'question',questionType:'short_text',prompt:'Synthetic additional column',required:false}}),201)
 current=await readDraft()
 const previous=current.steps.find((step:any)=>step.prompt==='Anything else?'),newStep=current.steps.find((step:any)=>step.prompt==='Synthetic additional column')
 await accepted(await f.call(base+'/draft',{expectedVersion:current.flow.draftVersion,stepId:previous.id,prompt:previous.prompt,required:previous.required,nextStepId:newStep.id},{method:'PUT'}))
 await accepted(await f.call(base+'/publish',{expectedVersion:(await readDraft()).flow.draftVersion}),201)
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 const after=await sheet();expect(after.filter(row=>row[0])).toHaveLength(5);expect(after[0].slice(0,oldHeader.length)).toEqual(oldHeader)
 const added=(await readDraft()).steps.find((step:any)=>step.prompt==='Synthetic additional column')
 expect(after[0].at(-1)).toContain(added.id);expect(after[0].at(-1)).toContain('Synthetic additional column');expect(after.some(row=>row.includes('Synthetic sheet row 4'))).toBe(true)
 // RESP-021 has no public editing door yet. Its eventual native answer write already enqueues this in-place update.
 await env.DB.prepare('UPDATE response_answers SET value_json=?,updated_at=? WHERE response_id=? AND step_id=?').bind(JSON.stringify('Synthetic edited sheet answer'),new Date().toISOString(),fourth,(await readDraft()).steps.find((step:any)=>step.prompt==='Anything else?').id).run()
 await accepted(await f.call(base+'/google-sheet/sync',{}));expect((await sheet()).some(row=>row.includes('Synthetic edited sheet answer'))).toBe(true);expect((await sheet()).filter(row=>row[0])).toHaveLength(5)
 await fetch(receiver+'/__control/google-mode',{method:'POST',body:JSON.stringify({down:true})})
 const missing=[] as string[];for(let n=5;n<=9;n++)missing.push(await submit(n))
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 let ledger=await accepted(await f.call('/api/app/integration-deliveries?state=failed'))
 const failed=ledger.deliveries.filter((row:any)=>row.kind==='sheet');expect(failed.map((row:any)=>row.responseId).sort()).toEqual(missing.sort())
 expect(failed.every((row:any)=>row.attempts.some((attempt:any)=>attempt.httpStatus===503&&attempt.reason.includes('503')))).toBe(true)
 const alert=await accepted(await f.call('/api/app/webhooks/alerts'));expect(alert.alerts.some((row:any)=>row.message.includes('5 Google Sheets'))).toBe(true)
 await fetch(receiver+'/__control/google-mode',{method:'POST',body:JSON.stringify({down:false})})
 for(const row of failed)await accepted(await f.call(`/api/app/google-sheet/deliveries/${row.id}/replay`,{}))
 expect((await sheet()).filter(row=>row[0])).toHaveLength(10)
 ledger=await accepted(await f.call('/api/app/integration-deliveries?state=confirmed'));expect(ledger.deliveries.filter((row:any)=>row.kind==='sheet')).toHaveLength(9)
 const replay=ledger.deliveries.find((row:any)=>row.kind==='sheet');await accepted(await f.call(`/api/app/google-sheet/deliveries/${replay.id}/replay`,{}));expect((await sheet()).filter(row=>row[0])).toHaveLength(10)
 await accepted(await f.call('/api/app/responses/'+first[0],undefined,{method:'DELETE'}),204)
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 expect((await sheet()).flat()).not.toContain('Synthetic sheet row 1');expect((await sheet()).filter(row=>row[0])).toHaveLength(9)
 const all=(await everyStoredValue()).join('\n');for(const secret of [config.clientSecret,'synthetic-pencil-google-access','synthetic-pencil-google-refresh'])expect(all).not.toContain(secret)
 const backup=await accepted(await f.call('/api/app/backup/export',{}));for(const secret of [config.clientSecret,'synthetic-pencil-google-access','synthetic-pencil-google-refresh'])expect(JSON.stringify(backup)).not.toContain(secret)
 expect(backup.payload.tables.find((table:any)=>table.name==='google_oauth_states').rows).toEqual([])
})
