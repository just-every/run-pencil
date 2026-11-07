import { matureLoad } from './load-time-fixture'
import { analysisHttp } from './analysis-fixture'
import { surveyMonkeyDetails, surveyMonkeyResponses } from '../fixtures/form-import/surveymonkey'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { FormImports, importContext, type ImportActor } from '../../src/core/features/importing/service'
import { readD1ImportOriginals, readD1PersistedImport } from '../../src/base/import-kit/src/d1/index'
import { formJson, csv, simpleJson, simpleCsv } from '../fixtures/form-import/fixture'
import { prepareImport } from '../../src/core/features/importing/prepare'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { createPencilServices } from '../../src/core/app/services'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const second = (env as unknown as { IMPORT_SECOND: D1Database }).IMPORT_SECOND
beforeAll(async () => { await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__); await applyD1Migrations(second, __PENCIL_CORE_MIGRATIONS__) })
async function fixture(database = env.DB) {
  const workspaceId = crypto.randomUUID(), operatorId = crypto.randomUUID(), id = crypto.randomUUID(), now = new Date().toISOString()
  await database.prepare("INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES(?,'Synthetic import','UTC','09:00','17:00',?,?)").bind(workspaceId, now, now).run()
  await database.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,'Synthetic importer',0,?,?)").bind(operatorId, workspaceId, `${operatorId}@example.test`, now, now).run()
  await database.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,1,'native',?,?)").bind(id, id, operatorId, Date.now(), Date.now() + 3600000).run()
  const actor: ImportActor = { id, workspaceId, operatorId }
  return { actor, service: new FormImports(database, actor), database }
}
const input = { definition: formJson, csv, plannedAt: '2026-10-08T00:00:00.000Z' }
async function committed(f: Awaited<ReturnType<typeof fixture>>, source = input) {
  const review = await f.service.review(source)
  expect(review.rowErrors).toEqual([])
  let job = await f.service.commit({ ...source, plannedAt: review.plannedAt, columns: review.columns }, review.fingerprint, true)
  while (job.state !== 'completed') job = await new FormImports(f.database, f.actor).resume(job.id)
  return { review, job }
}
async function nativeSnapshot(db: D1Database, flowId: string) {
  return {
    structure: (await db.prepare('SELECT s.position,s.stable_id,s.kind,s.question_type,s.prompt,s.helper_text,s.required,s.next_step_stable_id,s.question_settings_json FROM flow_steps s JOIN flow_revisions r ON r.id=s.revision_id WHERE r.flow_id=? AND r.state=\'published\' ORDER BY s.position').bind(flowId).all()).results,
    answers: (await db.prepare('SELECT a.step_id,a.value_json,r.source,r.started_at,r.completed_at,r.state FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=? ORDER BY a.step_id,a.value_json,r.source,r.started_at,r.completed_at').bind(flowId).all()).results,
    count: await db.prepare('SELECT count(*) AS total FROM responses WHERE flow_id=?').bind(flowId).first(),
  }
}
contract(['IMPORT-001', 'IMPORT-002', 'IMPORT-003', 'IMPORT-004', 'LEDG-002', 'IMPORT-005', 'FIELD-013', 'FIELD-016', 'FIELD-010'], 'two fresh databases produce equivalent reports, source structures, typed answers and 27 inert completions', async () => {
  const a = await fixture(), b = await fixture(second)
  const first = await committed(a), next = await committed(b)
  expect(first.review.report).toEqual(next.review.report)
  const imported = await nativeSnapshot(a.database,first.review.flowId)
  for (const [prompt,settings] of [['Name',{maxLength:150}],['Experience',{min:0,max:10,lowLabel:'Low',middleLabel:'Neutral',highLabel:'High'}],['Visit date',{displayFormat:'DD/MM/YYYY',separator:'.'}]] as const) expect(JSON.parse(String(imported.structure.find(step=>step.prompt===prompt)?.question_settings_json))).toMatchObject(settings)

  expect(await nativeSnapshot(a.database, first.review.flowId)).toEqual(await nativeSnapshot(b.database, next.review.flowId))
  expect(await a.database.prepare('SELECT count(*) AS total FROM responses WHERE flow_id=?').bind(first.review.flowId).first()).toEqual({ total: 27 })
  for (const table of ['respondent_sessions', 'response_outbox', 'revision_metric_counters', 'mail_deliveries', 'local_mail_outbox']) expect(await a.database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first()).toEqual({ total: 0 })
  const raw = await a.database.prepare('SELECT plan_json FROM ik_jobs WHERE id=?').bind(first.job.id).first<{ plan_json: string }>()
  expect(raw!.plan_json).not.toMatch(/forbidden-network|192\.0\.2\.|never-import-hidden-value|991827/)
  const context = importContext(a.database, a.actor, prepareImport(input, a.actor.workspaceId).namespace)
  expect((await readD1ImportOriginals(first.job.id, context)).every(o => o.original.status === 'unavailable')).toBe(true)
  const persisted = await readD1PersistedImport(context)
  expect(persisted.rows).toHaveLength(28)
  expect(persisted.provenance).toHaveLength(28)
  // The same reviewed import model also accepts an uploaded SurveyMonkey file pair through HTTP.
  const http=await analysisHttp({AI_ENABLED:'false'},'synthetic-pencil-sm')
  const source={source:'surveymonkey',definition:JSON.stringify(surveyMonkeyDetails),csv:JSON.stringify(surveyMonkeyResponses)}
  const call=async(path:string,body?:unknown)=>{const response=await http.call(path,body);expect(response.ok,await response.clone().text()).toBe(true);return response.json() as Promise<any>}
  const custody=async()=>({
    flows:await env.DB.prepare('SELECT count(*) n FROM flows WHERE workspace_id=?').bind(http.workspaceId).first(),
    responses:await env.DB.prepare('SELECT count(*) n FROM responses WHERE workspace_id=?').bind(http.workspaceId).first(),
    preparation:await env.DB.prepare('SELECT count(*) n FROM ik_d1_staging WHERE destination=?').bind(http.workspaceId).first(),
    jobs:await call('/api/app/imports'),
  })
  const before=await custody()
  const effects=async()=>Promise.all(['respondent_sessions','response_outbox','revision_metric_counters','mail_deliveries','local_mail_outbox'].map(async table=>(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results))
  const beforeEffects=await effects()
  // Both review and commit validate the upload before any native or import job writes.
  for(const change of ['unknown row','unknown choice','duplicate row','duplicate selection','duplicate row definition','duplicate choice definition']) {
    const definition=structuredClone(surveyMonkeyDetails), responses=structuredClone(surveyMonkeyResponses)
    const matrix=definition.pages[0].questions.find(question=>question.id==='synthetic-pencil-120')!.answers!
    const answers=responses.data[0].pages[0].questions.find(question=>question.id==='synthetic-pencil-120')!.answers
    if(change==='unknown row')answers[0].row_id='synthetic-pencil-unknown'
    if(change==='unknown choice')answers[0].choice_id='synthetic-pencil-unknown'
    if(change==='duplicate row')answers.push({...answers[0],choice_id:'synthetic-pencil-123'})
    if(change==='duplicate selection')answers.push({...answers[0]})
    if(change==='duplicate row definition')matrix.rows!.push({...matrix.rows![0]})
    if(change==='duplicate choice definition')matrix.choices!.push({...matrix.choices![0]})
    const malformed={...source,definition:JSON.stringify(definition),csv:JSON.stringify(responses)}
    for(const path of ['/api/app/imports/review','/api/app/imports/commit']) {
      const refused=await http.call(path,path.endsWith('/commit')?{...malformed,acknowledged:true,fingerprint:'0'.repeat(64)}:malformed)
      expect(refused.status,change).toBe(400)
      expect(await refused.text()).toContain('Nothing was written')
    }
    expect(await custody(),change).toEqual(before)
  }
  const review=await call('/api/app/imports/review',source)
  expect(review).toMatchObject({source:'surveymonkey',responseCount:3,rowErrors:[]})
  expect(review.report).toEqual(expect.arrayContaining([
    expect.objectContaining({label:'Unsupported matrix menus',state:'unsupported'}),expect.objectContaining({label:'Later descriptive text',state:'unsupported'}),expect.objectContaining({sourceType:'collector',state:'unsupported'}),
  ]))
  const text=review.questions.find((step:any)=>step.prompt==='Your reference code'), choice=review.questions.find((step:any)=>step.prompt==='Which option fits?'), scale=review.questions.find((step:any)=>step.prompt==='How helpful was this?')
  const matrix=review.questions.find((step:any)=>step.prompt==='Service experience matrix')
  expect(matrix).toMatchObject({questionType:'matrix',required:false,settings:{matrixMode:'single',matrixRows:[{label:'Clarity'},{label:'Speed'},{label:'Support'}]},choices:[{label:'Good'},{label:'Needs work'},{label:'Not used'}]})
  for(const label of ['Clarity','Speed','Support','Good','Needs work','Not used'])expect(review.report).toContainEqual(expect.objectContaining({label,state:'imported'}))
  expect((await call('/api/app/imports/review',source)).questions).toEqual(review.questions)
  const [clarity,speed,support]=matrix.settings.matrixRows.map((row:any)=>row.id), [good,needsWork,unused]=matrix.choices.map((option:any)=>option.id)
  const historical=[{[clarity]:good,[speed]:needsWork},{[clarity]:unused,[support]:unused}]
  expect(text.settings).toMatchObject({minLength:8,maxLength:8,inputMask:'###-####',pattern:'[0-9]{3}-[0-9]{4}'})
  expect(scale.settings).toEqual({min:0,max:6,lowLabel:'Not at all',middleLabel:'Neutral',highLabel:'Completely'})
  let job=await call('/api/app/imports/commit',{...source,columns:review.columns,plannedAt:review.plannedAt,fingerprint:review.fingerprint,acknowledged:true})
  while(job.state!=='completed')job=await call(`/api/app/imports/${job.id}/resume`,{})
  const answers=(await env.DB.prepare('SELECT a.step_id,a.value_json,r.response_context_json FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=?').bind(review.flowId).all()).results
  expect(JSON.parse(String(answers.find(answer=>answer.step_id===choice.id)?.value_json))).toEqual({choiceIds:[choice.settings.otherChoiceId],otherText:'Blue'})
  expect(JSON.parse(String(answers.find(answer=>answer.step_id===scale.id)?.value_json))).toBe(0)
  expect(JSON.parse(String(answers[0].response_context_json)).hidden[review.settings.hiddenFields[0].id]).toBe('enterprise')
  const ledger=await call(`/api/app/flows/${review.flowId}/ledger`)
  expect(ledger.responses).toHaveLength(3)
  const importedRows=[...ledger.responses].sort((a:any,b:any)=>a.completedAt.localeCompare(b.completedAt))
  expect(importedRows.map((row:any)=>row.answers.find((answer:any)=>answer.stepId===matrix.id)?.value)).toEqual([...historical,undefined])
  expect((await env.DB.prepare('SELECT value_json FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=? AND a.step_id=? ORDER BY r.completed_at').bind(review.flowId,matrix.id).all()).results.map(answer=>JSON.parse(String(answer.value_json)))).toEqual(historical)
  expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=? AND source=\'imported\' AND notification_eligible=0 AND state=\'released\'').bind(review.flowId).first()).toEqual({n:3})
  expect(await effects()).toEqual(beforeEffects)
  const draft=await call(`/api/app/flows/${review.flowId}/draft`)
  expect(draft.steps.find((step:any)=>step.id===matrix.id).questionSettings).toEqual(matrix.settings)
  expect(draft.choices.filter((option:any)=>option.stepId===matrix.id).map((option:any)=>option.id)).toEqual(matrix.choices.map((option:any)=>option.id))
  await call(`/api/app/flows/${review.flowId}/publish`,{expectedVersion:draft.flow.draftVersion})
  const slug=draft.flow.slug
  const session=await call(`/api/public/flows/${slug}/sessions`,{source:'direct',deviceClass:'desktop'})
  expect((await http.call(`/api/public/flows/${slug}/responses`,{...session,idempotencyKey:'synthetic-pencil-sm-invalid',answers:[{stepId:text.id,value:'bad'}]})).status).toBe(400)
  await matureLoad(session)
  const nativeMatrix={[clarity]:needsWork,[support]:good}
  const valid=await call(`/api/public/flows/${slug}/responses`,{...session,idempotencyKey:'synthetic-pencil-sm-valid',answers:[{stepId:text.id,value:'555-0100'},{stepId:matrix.id,value:nativeMatrix}]})
  expect(valid.disposition).toBe('released')
  expect(JSON.parse((await env.DB.prepare('SELECT value_json FROM response_answers WHERE response_id=? AND step_id=?').bind(valid.responseId,matrix.id).first<{value_json:string}>())!.value_json)).toEqual(nativeMatrix)
  const optional=await call(`/api/public/flows/${slug}/sessions`,{source:'direct',deviceClass:'desktop'})
  await matureLoad(optional)
  const omitted=await call(`/api/public/flows/${slug}/responses`,{...optional,idempotencyKey:'synthetic-pencil-sm-optional',answers:[{stepId:text.id,value:'555-0100'}]})
  expect(omitted.disposition).toBe('released')
  expect(await env.DB.prepare('SELECT count(*) n FROM response_answers WHERE response_id=? AND step_id=?').bind(omitted.responseId,matrix.id).first()).toEqual({n:0})
  expect((await call(`/api/app/flows/${review.flowId}/ledger`)).responses.filter((row:any)=>row.source==='imported').map((row:any)=>row.answers.find((answer:any)=>answer.stepId===matrix.id)?.value).filter(Boolean)).toEqual(expect.arrayContaining(historical))
  // Undo is checked on a second, unedited import; publication is deliberately a later native edit.
  const undoSource={...source,definition:JSON.stringify({...surveyMonkeyDetails,title:'Synthetic undo intake'})}
  const undoReview=await call('/api/app/imports/review',undoSource)
  let undoJob=await call('/api/app/imports/commit',{...undoSource,columns:undoReview.columns,plannedAt:undoReview.plannedAt,fingerprint:undoReview.fingerprint,acknowledged:true})
  while(undoJob.state!=='completed')undoJob=await call(`/api/app/imports/${undoJob.id}/resume`,{})
  const importedIds={
    flow_revisions:(await env.DB.prepare('SELECT id FROM flow_revisions WHERE flow_id=?').bind(undoReview.flowId).all()).results,
    flow_steps:(await env.DB.prepare('SELECT s.id FROM flow_steps s JOIN flow_revisions r ON r.id=s.revision_id WHERE r.flow_id=?').bind(undoReview.flowId).all()).results,
    choice_options:(await env.DB.prepare('SELECT c.id FROM choice_options c JOIN flow_steps s ON s.id=c.step_id JOIN flow_revisions r ON r.id=s.revision_id WHERE r.flow_id=?').bind(undoReview.flowId).all()).results,
    response_answers:(await env.DB.prepare('SELECT a.id FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=?').bind(undoReview.flowId).all()).results,
  }
  for(const ids of Object.values(importedIds))expect(ids.length).toBeGreaterThan(0)
  undoJob=await call(`/api/app/imports/${undoJob.id}/undo`,{})
  while(undoJob.state!=='undone')undoJob=await call(`/api/app/imports/${undoJob.id}/resume`,{})
  expect(await env.DB.prepare('SELECT count(*) n FROM flows WHERE id=?').bind(undoReview.flowId).first()).toEqual({n:0})
  expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(undoReview.flowId).first()).toEqual({n:0})
  for(const [table,ids] of Object.entries(importedIds))expect(await env.DB.prepare(`SELECT count(*) n FROM ${table} WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids.map(row=>row.id)).first()).toEqual({n:0})

}, 90_000)
contract(['IMPORT-003', 'IMPORT-004', 'BASE-OPS-005'], 'native kit undo removes imported flow and responses, retains safe provenance, and preserves same-revision edits', async () => {
  const f = await fixture(), result = await committed(f)
  let reversed = await f.service.undo(result.job.id)
  while (reversed.state !== 'undone') reversed = await new FormImports(f.database, f.actor).resume(reversed.id)
  expect((await f.service.undo(reversed.id)).state).toBe('undone')
  expect(await f.database.prepare('SELECT COUNT(*) AS total FROM flows WHERE id=?').bind(result.review.flowId).first()).toEqual({ total: 0 })
  expect(await f.database.prepare('SELECT COUNT(*) AS total FROM responses WHERE flow_id=?').bind(result.review.flowId).first()).toEqual({ total: 0 })
  expect(await f.database.prepare('SELECT COUNT(*) AS total FROM ik_provenance WHERE job_id=? AND reversed=1').bind(result.job.id).first()).toEqual({ total: 28 })
  expect(await f.database.prepare("SELECT count(*) AS total FROM audit_entries WHERE workspace_id=? AND kind='import.reversed' AND actor_operator_id=? AND subject_id IS NULL AND created_at IS NOT NULL").bind(f.actor.workspaceId, f.actor.operatorId).first()).toEqual({ total: 28 })
  const edited = await fixture(), small = { definition: simpleJson, csv: simpleCsv, plannedAt: input.plannedAt }, imported = await committed(edited, small)
  const flows = createPencilServices(createPencilPlatform('http://localhost', env)).flows
  const draft = await flows.getBuilderDraft(edited.actor.workspaceId, imported.review.flowId)
  const question = draft.steps.find(step => step.kind === 'question')!
  expect(await flows.updateBuilderDraft({ workspaceId: edited.actor.workspaceId, operatorId: edited.actor.operatorId, flowId: imported.review.flowId, expectedVersion: draft.flow.draftVersion, stepId: question.id, prompt: 'Later native edit', required: question.required })).toMatchObject({ kind: 'updated' })
  await expect(edited.service.undo(imported.job.id)).rejects.toThrow('NATIVE_EDIT_CONFLICT')
  expect(await edited.database.prepare("SELECT prompt FROM flow_steps WHERE revision_id=(SELECT id FROM flow_revisions WHERE flow_id=? AND state='draft') AND kind='question'").bind(imported.review.flowId).first()).toEqual({ prompt: 'Later native edit' })
  expect(await edited.database.prepare("SELECT prompt FROM flow_steps WHERE revision_id=(SELECT id FROM flow_revisions WHERE flow_id=? AND state='published') AND kind='question'").bind(imported.review.flowId).first()).toEqual({ prompt: 'Answer' })
}, 90_000)
