import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { ReportingRepository } from '../../src/core/features/reporting/repository'
import { startExport, exportPart } from '../../src/core/features/reporting/export'
import { textPage } from '../../src/core/features/reporting/textPage'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { initializePencil } from '../../src/core/app/worker'
import { generation } from '../../src/core/features/reporting/cursor'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const secret='synthetic-bounded-report-key-not-a-real-credential'
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
async function fixture(slug:string, count=70) {
  const f=await foundationFixture(slug)
  await f.add({kind:'question',questionType:'long_text',prompt:'Published comment',required:false})
  await f.add({kind:'completion',questionType:null,prompt:'Complete'})
  const published=await f.publish(), draft=await f.draft(), questionId=draft.steps[0].id
  const session=await f.start();await f.mature(session.sessionId)
  const receipt=await f.final(session,[{stepId:questionId,value:'Initial answer'}])
  const values = Array.from({length:count},(_,index)=>index===0 ? '' : index===1 ? `É%_'"${'x'.repeat(500)}` : `Duplicate ${'z'.repeat(4980)}`)
  for(let index=0;index<count;index++) {
    const id=`${slug}-${String(index).padStart(3,'0')}`
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,released_at,completion_milliseconds,completed_at,created_at,updated_at,source)
        SELECT ?,workspace_id,flow_id,revision_id,?,'synthetic','synthetic','released',released_at,0,completed_at,created_at,updated_at,'unknown' FROM responses WHERE id=?`).bind(id,id,receipt.responseId),
      env.DB.prepare(`INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at) SELECT ?,?,step_id,?,created_at,updated_at FROM response_answers WHERE response_id=?`).bind(id,id,JSON.stringify(values[index]),receipt.responseId),
    ])
  }
  const identity={workspaceId:f.scope.workspaceId,flowId:f.flow.flowId,sessionId:'synthetic-authorized-session'}
  return {...f,identity,questionId,revisionId:published.revision.id,values,receipt}
}
contract(['RSLT-001','RSLT-005','LEDG-001','LEDG-002'], 'bounded native summaries and downloads retain every duplicate empty and large answer',async()=> {
  const f=await fixture('bounded-report-pages')
  const repository=new ReportingRepository(env.DB)
  const reports=await repository.questionReport(f.revisionId)
  expect(reports[0]).toMatchObject({answered:71,summary:{texts:[]}})
  expect(JSON.stringify(reports).length).toBeLessThan(2000)
  const start=await startExport(env.DB,secret,f.identity,{},'json')
  let token:string|undefined=start.token,parts=0,content='',maxPart=0
  while(token) {
    const part=await exportPart(env.DB,secret,f.identity,token,new AbortController().signal)
    const bytes=await new Response(part.stream).text();content+=bytes;maxPart=Math.max(maxPart,new TextEncoder().encode(bytes).length);parts++;token=part.nextToken
  }
  const records=JSON.parse(content).responses
  expect(records).toHaveLength(71);expect(new Set(records.map((row:{id:string})=>row.id)).size).toBe(71)
  expect(parts).toBeGreaterThan(2);expect(maxPart).toBeLessThan(1024*1024)
  expect(records.flatMap((row:{answers:Array<{value:string}>})=>row.answers.map(answer=>answer.value)).sort()).toEqual([...f.values,'Initial answer'].sort())
  const csvStart=await startExport(env.DB,secret,f.identity,{},'csv')
  const csvPart=await exportPart(env.DB,secret,f.identity,csvStart.token,new AbortController().signal)
  expect(await new Response(csvPart.stream).text()).toContain('omitted_questions_json')
},60000)
contract(['RSLT-001','BASE-ACCESS-002','BASE-INPUT-001'], 'text cursors search all Unicode literal evidence and retain timestamp ties without accepting foreign scopes',async()=> {
  const f=await fixture('bounded-text-search')
  const input={revisionId:f.revisionId,questionId:f.questionId,search:''}
  let cursor:string|undefined,values:string[]=[]
  do { const page=await textPage(env.DB,secret,f.identity,{...input,cursor});values.push(...page.texts);cursor=page.cursor } while(cursor)
  expect(values.sort()).toEqual([...f.values,'Initial answer'].sort())
  const first=await textPage(env.DB,secret,f.identity,input)
  expect(first.cursor).toBeTruthy()
  for(const identity of [{...f.identity,workspaceId:'foreign-workspace'},{...f.identity,flowId:'foreign-flow'}]) await expect(textPage(env.DB,secret,identity,{...input,cursor:first.cursor})).rejects.toThrow()
  for(const foreign of [{revisionId:'foreign-revision'},{questionId:'foreign-question'}]) await expect(textPage(env.DB,secret,f.identity,{...input,...foreign,cursor:first.cursor})).rejects.toThrow()
  await expect(exportPart(env.DB,secret,f.identity,first.cursor!,new AbortController().signal)).rejects.toThrow(/Invalid export cursor/)
  await expect(textPage(env.DB,secret,{...f.identity,sessionId:'other'}, {...input,cursor:first.cursor})).rejects.toThrow()
  await expect(textPage(env.DB,secret,f.identity,{...input,search:'changed',cursor:first.cursor})).rejects.toThrow()
  await expect(textPage(env.DB,secret,f.identity,{...input,cursor:'malformed'})).rejects.toThrow()
  const surrogate=await textPage(env.DB,secret,f.identity,{...input,search:'\uD800'})
  await expect(textPage(env.DB,secret,f.identity,{...input,search:'\uFFFD',countOnly:true,cursor:surrogate.countCursor})).rejects.toThrow(/different report/)
  values=[];cursor=undefined
  do {const page=await textPage(env.DB,secret,f.identity,{...input,search:`é%_'"${'x'.repeat(500)}`,cursor});values.push(...page.texts);cursor=page.cursor}while(cursor)
  expect(values).toEqual([f.values[1]])
  await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=?').bind('"Same count replacement"',f.receipt.responseId).run()
  await expect(textPage(env.DB,secret,f.identity,{...input,cursor:first.cursor})).rejects.toThrow(/changed/)
},60000)
contract(['LEDG-002','BASE-DATA-003','BASE-OPS-004'], 'same-count edits abort continuations and changes after headers abort streams without an error record',async()=> {
  const f=await fixture('bounded-export-change',3)
  const start=await startExport(env.DB,secret,f.identity,{},'json')
  await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=?').bind('"Changed value"',f.receipt.responseId).run()
  await expect(exportPart(env.DB,secret,f.identity,start.token,new AbortController().signal)).rejects.toThrow(/changed/)
  const current=await startExport(env.DB,secret,f.identity,{},'json')
  const part=await exportPart(env.DB,secret,f.identity,current.token,new AbortController().signal)
  await env.DB.prepare('UPDATE responses SET completed_at=completed_at WHERE id=?').bind(f.receipt.responseId).run()
  await expect(new Response(part.stream).text()).rejects.toThrow()
  const abort=new AbortController();abort.abort()
  await expect(exportPart(env.DB,secret,f.identity,current.token,abort.signal)).rejects.toThrow()
},60000)
contract(['BASE-OPS-002','BASE-DATA-001','LEDG-002'], 'reporting migration retains earlier rows and detects participant contact import and answer mutations',async()=> {
  const previous=__PENCIL_CORE_MIGRATIONS__.filter(migration=>!migration.name.startsWith('0020'))
  await applyD1Migrations(env.IMPORT_SECOND,previous)
  await initializePencil(createPencilPlatform('http://localhost',{...env,DB:env.IMPORT_SECOND}))
  await env.IMPORT_SECOND.prepare(`INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) SELECT 'retained-empty-flow',workspace_id,'retained-empty-flow','Retained empty flow','draft',0,last_activity_at,created_at,updated_at FROM flows LIMIT 1`).run()
  const counts=async()=> (await env.IMPORT_SECOND.prepare('SELECT (SELECT COUNT(*) FROM responses) AS responses, (SELECT COUNT(*) FROM response_answers) AS answers, (SELECT COUNT(*) FROM flow_steps) AS steps, (SELECT COUNT(*) FROM flows) AS flows').first())
  const retained=await counts()
  await applyD1Migrations(env.IMPORT_SECOND,__PENCIL_CORE_MIGRATIONS__)
  expect(await counts()).toEqual(retained)
  const workspace=await env.IMPORT_SECOND.prepare('SELECT id FROM workspaces LIMIT 1').first<{id:string}>()
  expect(await generation(env.IMPORT_SECOND,workspace!.id)).toBe(0)
  await env.IMPORT_SECOND.prepare("UPDATE flows SET id='renamed-empty-flow',workspace_id=workspace_id WHERE id='retained-empty-flow'").run()
  expect(await env.IMPORT_SECOND.prepare("SELECT flow_id FROM reporting_changes WHERE flow_id IN ('retained-empty-flow','renamed-empty-flow') ORDER BY flow_id").all()).toMatchObject({results:[{flow_id:'renamed-empty-flow'},{flow_id:'retained-empty-flow'}]})
  const afterRename=await generation(env.IMPORT_SECOND,workspace!.id)
  await env.IMPORT_SECOND.prepare("DELETE FROM flows WHERE id='renamed-empty-flow'").run()
  expect(await generation(env.IMPORT_SECOND,workspace!.id)).toBeGreaterThan(afterRename)
  expect(await env.IMPORT_SECOND.prepare("SELECT COUNT(*) AS n FROM flows WHERE id IN ('retained-empty-flow','renamed-empty-flow')").first()).toEqual({n:0})
  const f=await fixture('bounded-mutation-generation',1)
  const before=await generation(env.DB,f.scope.workspaceId)
  await env.DB.prepare('UPDATE response_answers SET value_json=value_json WHERE response_id=?').bind(f.receipt.responseId).run()
  expect(await generation(env.DB,f.scope.workspaceId)).toBeGreaterThan(before)
  const row=await env.DB.prepare('SELECT * FROM reporting_generations WHERE workspace_id=?').bind(f.scope.workspaceId).first()
  expect(Object.keys(row!).sort()).toEqual(['generation','workspace_id'])
  const contact=await f.services.distribution.contacts.save(f.scope.workspaceId,{name:'Retained name',email:'generation@example.test'}) as {id:string}
  const launch=await f.services.distribution.launches.launch({...f.flow,operatorId:f.operatorId,contactIds:[contact.id],commandKey:'synthetic-generation-launch'})
  const participant=await env.DB.prepare('SELECT id FROM invitation_participants WHERE launch_id=?').bind(launch.id).first<{id:string}>()
  await env.DB.prepare('UPDATE responses SET participant_id=? WHERE id=?').bind(participant!.id,f.receipt.responseId).run()
  const contactBefore=await generation(env.DB,f.scope.workspaceId)
  await env.DB.prepare('UPDATE distribution_contacts SET name=? WHERE id=?').bind('Same-count name edit',contact.id).run()
  expect(await generation(env.DB,f.scope.workspaceId)).toBeGreaterThan(contactBefore)
  const targetBefore=await generation(env.DB,f.scope.workspaceId)
  await env.DB.prepare("INSERT INTO form_import_targets(target_id,workspace_id,kind,revision,flow_id) VALUES(?,?,'response','synthetic',?)").bind(f.receipt.responseId,f.scope.workspaceId,f.flow.flowId).run()
  expect(await generation(env.DB,f.scope.workspaceId)).toBeGreaterThan(targetBefore)
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE flow_id=?').bind(f.flow.flowId).first()).toEqual({n:2})
})

contract(['LEDG-002','FLOW-019'], 'a page remains bounded with fifty maximum-length answers and exports every record',async()=> {
  const f=await fixture('bounded-wide-answers',1)
  await env.DB.prepare("UPDATE flow_steps SET position=50 WHERE revision_id=? AND kind='completion'").bind(f.revisionId).run()
  await env.DB.prepare(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<49)
    INSERT INTO flow_steps(id,revision_id,position,kind,question_type,prompt,required,created_at,updated_at,stable_id,question_settings_json)
    SELECT 'wide-step-'||i,?,i,'question','long_text','Historic question '||i,0,'2024-01-01','2024-01-01','wide-step-'||i,'{}' FROM n`).bind(f.revisionId).run()
  const value='漢'.repeat(5000)
  await env.DB.prepare(`INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at)
    SELECT r.id||s.stable_id,r.id,s.stable_id,?,'2024-01-01','2024-01-01' FROM responses r JOIN flow_steps s ON s.revision_id=r.revision_id
    WHERE r.flow_id=? AND s.kind='question' AND s.stable_id != ?`).bind(JSON.stringify(value),f.flow.flowId,f.questionId).run()
  await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id IN (SELECT id FROM responses WHERE flow_id=?)').bind(JSON.stringify(value),f.flow.flowId).run()
  const start=await startExport(env.DB,secret,f.identity,{},'json')
  let token:string|undefined=start.token,content='',parts=0
  while(token) {const part=await exportPart(env.DB,secret,f.identity,token,new AbortController().signal);const text=await new Response(part.stream).text();expect(new TextEncoder().encode(text).length).toBeLessThan(4*1024*1024);content+=text;token=part.nextToken;parts++}
  expect(parts).toBe(2)
  const responses=JSON.parse(content).responses
  expect(responses).toHaveLength(2)
  for(const row of responses) {expect(row.answers).toHaveLength(50);expect(row.answers.every((answer:{value:string})=>answer.value===value)).toBe(true)}
},60000)

contract(['LEDG-002','IMPORT-003'], 'post-cutoff collection and other flows leave the original complete export unchanged',async()=> {
  const f=await fixture('bounded-cutoff-collection',40)
  const initial=await startExport(env.DB,secret,f.identity,{},'json')
  // Advance the stored availability instant explicitly, avoiding clock-tie assumptions.
  const after=new Date(Date.parse(initial.cutoff)+1000).toISOString()
  await env.DB.prepare(`INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,released_at,completion_milliseconds,completed_at,created_at,updated_at,source)
    SELECT 'post-cutoff',workspace_id,flow_id,revision_id,'post-cutoff','synthetic','synthetic','released',?,0,?,?,?,'unknown' FROM responses WHERE id=?`).bind(after,after,after,after,f.receipt.responseId).run()
  const other=await fixture('bounded-another-flow',1)
  expect(other.flow.flowId).not.toBe(f.flow.flowId)
  let token:string|undefined=initial.token,content=''
  while(token) {const part=await exportPart(env.DB,secret,f.identity,token,new AbortController().signal);content+=await new Response(part.stream).text();token=part.nextToken}
  const exported=JSON.parse(content)
  expect(exported.responses).toHaveLength(41)
  expect(exported.responses.some((row:{id:string})=>row.id==='post-cutoff')).toBe(false)
  expect(exported.responses.every((row:{completedAt:string})=>row.completedAt<=initial.cutoff)).toBe(true)
},60000)

contract(['RSLT-003','RSLT-005','BASE-INPUT-002'], 'comparison pages retain every revision and count with maximum hostile option labels',async()=> {
  const f=await foundationFixture('bounded-comparison-labels')
  await f.add({kind:'question',questionType:'single_choice',prompt:'Original question',required:false,choices:Array.from({length:100},(_,index)=>({value:String(index),label:`${index} `+'\0é"'.repeat(98)}))})
  await f.add({kind:'completion',questionType:null,prompt:'Done'})
  for(let i=0;i<10;i++) await f.publish()
  const repository=new ReportingRepository(env.DB)
  let offset=0,seen:string[]=[],pages=0
  for(;;) {
    const page=await repository.revisionComparison(f.scope.workspaceId,f.flow.flowId,offset)
    expect(new TextEncoder().encode(JSON.stringify(page)).length).toBeLessThan(1024*1024)
    seen.push(...page.revisions.map(revision=>revision.id));pages++
    expect(page.questions[0].versions.every(version=>version.choices.length===100)).toBe(true)
    if(page.nextOffset===undefined) break
    expect(page.nextOffset).toBeGreaterThan(offset);offset=page.nextOffset
  }
  expect(pages).toBeGreaterThan(1);expect(seen).toHaveLength(10);expect(new Set(seen).size).toBe(10)
},60000)

contract(['RSLT-001','RSLT-003','BASE-ACCESS-002'], 'text counts cover the full fixed cohort through bounded authenticated continuations',async()=> {
  const f=await fixture('bounded-complete-count')
  for(const [search,expected] of [['',71],['duplicate',68],[`é%_'"${'x'.repeat(500)}`,1],['not present',0]] as const) {
    const input={revisionId:f.revisionId,questionId:f.questionId,search}
    const first=await textPage(env.DB,secret,f.identity,input)
    expect(first.texts.length).toBeLessThanOrEqual(5)
    expect(first.matching).toBeUndefined()
    let cursor=first.countCursor,matching:number|undefined,calls=0
    expect(cursor).toBeTruthy()
    await expect(textPage(env.DB,secret,f.identity,{...input,countOnly:true,cursor:first.cursor})).rejects.toThrow()
    while(cursor) {
      const page=await textPage(env.DB,secret,f.identity,{...input,countOnly:true,cursor})
      expect(page.texts).toEqual([]);expect(JSON.stringify(page).length).toBeLessThan(2000)
      cursor=page.countCursor;matching=page.matching;calls++
    }
    expect(calls).toBe(1);expect(matching).toBe(expected)
    await expect(textPage(env.DB,secret,{...f.identity,sessionId:'foreign'},{...input,countOnly:true,cursor:first.countCursor})).rejects.toThrow()
    await expect(textPage(env.DB,secret,f.identity,{...input,search:'different',countOnly:true,cursor:first.countCursor})).rejects.toThrow()
  }
  const first=await textPage(env.DB,secret,f.identity,{revisionId:f.revisionId,questionId:f.questionId,search:''})
  await env.DB.prepare('DELETE FROM response_answers WHERE response_id=?').bind(f.receipt.responseId).run()
  await expect(textPage(env.DB,secret,f.identity,{revisionId:f.revisionId,questionId:f.questionId,search:'',countOnly:true,cursor:first.countCursor})).rejects.toThrow(/changed/)
},60000)

contract(['FLOW-019','RSLT-001','BASE-OPS-004'], 'native summary text pages and counts reject UTF-16 overflow beyond embedded NUL or emoji',async()=> {
  const f=await fixture('bounded-text-validity',0),repository=new ReportingRepository(env.DB)
  for(const [type,limit] of [['short_text',200],['long_text',5000],['email',200]] as const) {
    await env.DB.prepare('UPDATE flow_steps SET question_type=? WHERE revision_id=? AND stable_id=?').bind(type,f.revisionId,f.questionId).run()
    const suffix=type==='email'?'@a.b':''
    for(const value of ['\0'+'a'.repeat(limit)+suffix,'😀'.repeat(limit)+suffix]) {
      await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=?').bind(JSON.stringify(value),f.receipt.responseId).run()
      await expect(repository.questionReport(f.revisionId)).rejects.toThrow(/Invalid retained answer/)
      await expect(textPage(env.DB,secret,f.identity,{revisionId:f.revisionId,questionId:f.questionId,search:''})).rejects.toThrow(/Invalid retained text answer/)
    }
    const value='\0'+'a'.repeat(limit-suffix.length-1)+suffix
    await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=?').bind(JSON.stringify(value),f.receipt.responseId).run()
    expect((await repository.questionReport(f.revisionId))[0].answered).toBe(1)
    expect((await textPage(env.DB,secret,f.identity,{revisionId:f.revisionId,questionId:f.questionId,search:''})).texts).toEqual([value])
  }
},60000)

contract(['RSLT-001','RSLT-003','BASE-OPS-004'], 'a count continuation limits native queries and reaches answers beyond its invocation budget',async()=> {
  const f=await fixture('bounded-count-invocations',0)
  await env.DB.prepare(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<16384)
    INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,released_at,completion_milliseconds,completed_at,created_at,updated_at,source)
    SELECT 'count-'||i,workspace_id,flow_id,revision_id,'count-'||i,'synthetic','synthetic','released',released_at,0,completed_at,created_at,updated_at,'unknown' FROM responses,n WHERE id=?`).bind(f.receipt.responseId).run()
  await env.DB.prepare(`INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at) SELECT r.id,r.id,?,'"É%_literal"',r.created_at,r.updated_at FROM responses r WHERE r.flow_id=? AND r.id!=?`).bind(f.questionId,f.flow.flowId,f.receipt.responseId).run()
  const input={revisionId:f.revisionId,questionId:f.questionId,search:'é%_literal'}
  const first=await textPage(env.DB,secret,f.identity,input)
  let statements=0,maxBindings=0,maxRows=0,maxBytes=0
  const measured={prepare(sql:string) {statements++;const statement=env.DB.prepare(sql);return {bind(...values:unknown[]) {maxBindings=Math.max(maxBindings,values.length);const bound=statement.bind(...values);return {first:()=>bound.first(),all:async()=>{const result=await bound.all();maxRows=Math.max(maxRows,result.results.length);maxBytes=Math.max(maxBytes,new TextEncoder().encode(JSON.stringify(result.results)).length);return result}}}}}} as unknown as D1Database
  const part=await textPage(measured,secret,f.identity,{...input,countOnly:true,cursor:first.countCursor})
  expect(part.matching).toBeUndefined();expect(part.countCursor).toBeTruthy();expect(part.texts).toEqual([])
  expect(statements).toBe(515);expect(maxBindings).toBe(11);expect(maxRows).toBe(32);expect(maxBytes).toBeLessThan(1024*1024)
  const final=await textPage(env.DB,secret,f.identity,{...input,countOnly:true,cursor:part.countCursor})
  expect(final.matching).toBe(16384);expect(final.countCursor).toBeUndefined()
  const abort=new AbortController();abort.abort();statements=0
  await expect(textPage(measured,secret,f.identity,{...input,countOnly:true,cursor:first.countCursor},abort.signal)).rejects.toThrow()
  expect(statements).toBe(0)
},60000)
