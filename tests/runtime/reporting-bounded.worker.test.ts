import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { startExport, exportPart } from '../../src/core/features/reporting/export'
import { textPage } from '../../src/core/features/reporting/textPage'
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
