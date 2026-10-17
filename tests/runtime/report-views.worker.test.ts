import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import type { ReportView, ReportDashboard } from '../../src/core/features/reportViews'
import type { CrossTabReport } from '../../src/core/features/reporting/crosstabs'
import { authoringClient } from './choice-recall-fixture'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import type { Policies } from '../../src/core/features/analysis/model'
import type { ImportReview } from '../../src/core/features/importing/model'
import { devKeyHeaders } from '../helpers/dev-key.mjs'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))

contract(['RSLT-008','BASE-ACCESS-004','BASE-DATA-003','BASE-OPS-005'], 'equal operators reopen frozen filtered crosstabs, arrange their form dashboard atomically, and erase its saved evidence with responses', async () => {
  const f = await authoringClient(), form = await f.create('Northstar saved crosstabs')
  await form.add({kind:'question',questionType:'yes_no',required:true,prompt:'Would you recommend us?'})
  await form.add({kind:'question',questionType:'yes_no',required:true,prompt:'Will you return?'})
  await form.add({kind:'completion',questionType:null,prompt:'Thank you'})
  await form.publish()
  const questions = (await form.draft()).steps.filter(step=>step.kind==='question')
  let revisionId = ''
  const submit = async (value:boolean) => {
    const session = await form.session(); revisionId=session.revisionId
    const receipt = await f.call<{responseId:string;disposition:string}>(`/api/public/flows/${form.slug}/responses`,{...session,idempotencyKey:'saved-view-'+session.sessionId,answers:questions.map(step=>({stepId:step.id,value}))})
    expect(receipt.disposition).toBe('released')
    return receipt.responseId
  }
  const matching = await submit(true)
  for (let i=1;i<6;i++) await submit(true)
  for (let i=0;i<6;i++) await submit(false)
  const path = form.root+'/report-views'
  const definition = {revisionId,row:{kind:'question' as const,stepId:questions[0].id},column:{kind:'question' as const,stepId:questions[1].id},filter:{source:'direct' as const,answerStepId:questions[0].id,answerValue:'true'}}
  const first = await f.call<ReportView>(path,{name:'Returning advocates',definition})
  expect(first.snapshot.totalRespondents).toBe(6)
  expect(first.snapshot.cells.find(cell=>cell.rowKey==='true'&&cell.columnKey==='true')?.count).toBe(6)
  expect(first.definition).toEqual(definition)
  const second = await f.call<ReportView>(path,{name:'All visitors',definition:{...definition,filter:{source:'direct'}}})
  expect(second.snapshot.totalRespondents).toBe(12)
  const signedOut = await SELF.fetch('http://localhost'+path,{headers:{Host:'localhost'}})
  expect(signedOut.status).toBe(401)
  const email = `report-reviewer-${crypto.randomUUID()}@example.test`
  const reviewer = await f.call<{id:string}>('/api/app/operators',{email,displayName:'Report reviewer'})
  await f.call('/auth/magic-link',{email})
  const inbox = await developmentInbox(path=>SELF.fetch('http://localhost'+path,{headers:{Host:'localhost',...devKeyHeaders}}),email)
  const login = await f.request('/auth/confirm',{token:inbox.messages[0].magicLinkToken})
  expect(login.status).toBe(303)
  const reviewerCookie = login.headers.get('set-cookie')!.split(';')[0]
  let serial=0
  const reviewerRequest = (path:string,body?:unknown,method=body===undefined?'GET':'POST')=>SELF.fetch('http://localhost'+path,{method,headers:{Host:'localhost',Origin:'http://localhost',cookie:reviewerCookie,'content-type':'application/json','CF-Connecting-IP':`198.18.218.${++serial}`},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const reopened = await reviewerRequest(path+'/'+first.id)
  expect(reopened.status).toBe(200); expect(await reopened.json()).toEqual(first)
  await submit(true)
  expect((await f.call<CrossTabReport>(form.root+'/crosstabs',definition)).totalRespondents).toBe(7)
  expect(await f.call<ReportView>(path+'/'+first.id)).toEqual(first)
  const dashboard = await f.call<ReportDashboard>(path)
  const arranged = await reviewerRequest(form.root+'/report-dashboard',{version:dashboard.version,viewIds:[second.id,first.id]},'PUT')
  expect(arranged.status).toBe(200)
  const ordered = await arranged.json<ReportDashboard>()
  expect(ordered.views.map(view=>view.id)).toEqual([second.id,first.id]);expect(ordered.version).toBeGreaterThan(dashboard.version)
  expect((await f.request(form.root+'/report-dashboard',{version:dashboard.version,viewIds:[first.id,second.id]},'PUT')).status).toBe(409)
  expect((await f.call<ReportDashboard>(path)).views.map(view=>view.id)).toEqual([second.id,first.id])
  const foreign = await f.create('Another form')
  expect((await f.request(foreign.root+'/report-views/'+first.id)).status).toBe(404)
  expect((await f.request(foreign.root+'/report-views',{name:'Wrong form',definition})).status).toBe(404)
  expect((await f.request(path,{name:'Client result',definition,snapshot:first.snapshot})).status).toBe(400)
  const reviewerSaved = await reviewerRequest(path,{name:'Reviewer summary',definition})
  expect(reviewerSaved.status).toBe(201)
  const authored = await reviewerSaved.json<ReportView>();expect(authored.createdBy?.id).toBe(reviewer.id)
  const assigneeView=await f.call<ReportView>(path,{name:'Reviewer assignment cohort',definition:{...definition,filter:{workflowAssignee:reviewer.id}}})
  await f.call(`/api/app/operators/${reviewer.id}`,undefined,'DELETE')
  expect((await f.request(path+'/'+assigneeView.id)).status).toBe(404)
  expect((await f.call<ReportView>(path+'/'+authored.id)).createdBy).toBeNull()
  await f.call(path+'/'+second.id,undefined,'DELETE')
  const audit = await f.call<{rows:Array<{kind:string;details:Record<string,unknown>}>}>(`/api/app/audit?flowId=${form.flow.id}&limit=100`)
  expect(audit.rows.map(row=>row.kind)).toEqual(expect.arrayContaining(['report_view.created','report_view.deleted','report_dashboard.arranged']))
  expect(audit.rows.filter(row=>row.kind.startsWith('report_')).every(row=>Object.keys(row.details).length===0)).toBe(true)
  await f.call(`/api/app/responses/${matching}`,undefined,'DELETE')
  expect((await f.call<ReportDashboard>(path)).views).toEqual([])
  expect((await f.request(path+'/'+first.id)).status).toBe(404)
  expect(await env.DB.prepare('SELECT count(*) AS n FROM report_views WHERE flow_id=?').bind(form.flow.id).first()).toEqual({n:0})
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE kind LIKE 'report_%' AND (instr(details_json,?)>0 OR instr(details_json,?)>0)").bind(first.name,email).first()).toEqual({n:0})
  const policyView=await f.call<ReportView>(path,{name:'Before stricter disclosure',definition})
  const {policies}=await f.call<{policies:Policies}>('/api/app/analysis')
  await f.call('/api/app/analysis/policies',{...policies,disclosureThreshold:policies.disclosureThreshold+1},'PUT')
  expect((await f.request(path+'/'+policyView.id)).status).toBe(404)
  await f.call('/api/app/analysis/policies',policies,'PUT')
  expect((await f.call<ReportDashboard>(path)).views).toEqual([])
  // Public import undo also deletes saved source evidence, with its containing form.
  const historical = {definition:JSON.stringify({title:'Historical dashboard',fields:[{ref:'return',type:'yes_no',title:'Return?'},{ref:'recommend',type:'yes_no',title:'Recommend?'}]}),csv:'',responses:JSON.stringify({items:Array.from({length:6},()=>({submitted_at:'2026-10-01T10:00:00Z',answers:[{field:{ref:'return'},type:'boolean',boolean:true},{field:{ref:'recommend'},type:'boolean',boolean:true}]}))})}
  const review = await f.call<ImportReview>('/api/app/imports/review',historical)
  expect(review.rowErrors).toEqual([])
  let job = await f.call<{id:string;state:string}>('/api/app/imports/commit',{...historical,columns:review.columns,plannedAt:review.plannedAt,fingerprint:review.fingerprint,acknowledged:true})
  while(job.state!=='completed') job=await f.call(`/api/app/imports/${job.id}/resume`,{})
  const importedRoot=`/api/app/flows/${review.flowId}`
  const imported = await f.call<{responses:Array<{revisionId:string}>}>(importedRoot+'/ledger')
  const importedView = await f.call<ReportView>(importedRoot+'/report-views',{name:'Imported historical evidence',definition:{revisionId:imported.responses[0].revisionId,row:{kind:'question',stepId:review.questions[0].id},column:{kind:'question',stepId:review.questions[1].id}}})
  expect(importedView.snapshot.totalRespondents).toBe(6)
  job=await f.call(`/api/app/imports/${job.id}/undo`,{})
  while(job.state!=='undone') job=await f.call(`/api/app/imports/${job.id}/resume`,{})
  expect(await env.DB.prepare('SELECT count(*) AS n FROM report_views WHERE id=?').bind(importedView.id).first()).toEqual({n:0})
  expect(await env.DB.prepare('SELECT count(*) AS n FROM report_dashboards WHERE flow_id=?').bind(review.flowId).first()).toEqual({n:0})
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
},60000)
