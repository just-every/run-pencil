import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { importPrivacyFixture } from './import-privacy-fixture'
import { FormImports } from '../../src/core/features/importing/service'
import { importTransportObserver } from './import-transport-observer'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const plannedAt='2026-10-08T00:00:00.000Z'
const privateTables=['ik_d1_native_staging','ik_d1_native_staging_index','ik_d1_native_staging_values','ik_d1_publication_fences','form_import_native_publication_fences','ik_d1_preparation_receipts','ik_d1_staging_headers']
function limits(stats:ReturnType<typeof importTransportObserver>['stats']){expect(stats.maxBatchBytes).toBeLessThanOrEqual(2*1024*1024);expect(stats.queries).toBeLessThanOrEqual(1000);expect(stats.maxBindings).toBeLessThanOrEqual(100);expect(stats.maxSqlBytes).toBeLessThanOrEqual(100000);expect(stats.maxValueBytes).toBeLessThanOrEqual(2000000)}
async function privateEmpty(){for(const table of privateTables)expect(await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first()).toEqual({n:0})}
contract(['IMPORT-001','IMPORT-002','IMPORT-004'],'the maximum choice form remains one atomic entity with bounded native transport and complete reversal',async()=>{
  const f=await importPrivacyFixture(),labels=Array.from({length:49},(_,q)=>Array.from({length:100},(_,i)=>String(i).padStart(3,'0')+String.fromCharCode(0x4e00+q).repeat(297)))
  const input={plannedAt,definition:JSON.stringify({title:'Maximum native choices',fields:labels.map((choices,q)=>({ref:`q${q}`,title:`Q${q}`,type:'dropdown',properties:{choices:choices.map((label,i)=>({ref:`c${i}`,label}))}}))}),csv:''}
  expect(new TextEncoder().encode(input.definition).byteLength).toBeLessThan(8*1024*1024)
  const meter=importTransportObserver(env.DB),service=new FormImports(meter.database,f.actor),review=await service.review(input);limits(meter.stats)
  expect(review.rowErrors).toEqual([]);meter.reset()
  let job=await service.commit(input,review.fingerprint,true);limits(meter.stats);expect(job.state).toBe('preparing');expect(job.checkpoint).toBe(0)
  expect(await env.DB.prepare('SELECT id FROM flows WHERE id=?').bind(review.flowId).first()).toBeNull()
  meter.reset();job=await new FormImports(meter.database,f.actor).resume(job.id);limits(meter.stats);expect(job.state).toBe('completed');await privateEmpty()
  const revisions=(await env.DB.prepare('SELECT id FROM flow_revisions WHERE flow_id=? ORDER BY number').bind(review.flowId).all<{id:string}>()).results;expect(revisions).toHaveLength(2)
  for(const revision of revisions){const actual=(await env.DB.prepare('SELECT s.position question,c.position choice,c.label FROM choice_options c JOIN flow_steps s ON s.id=c.step_id WHERE s.revision_id=? ORDER BY s.position,c.position').bind(revision.id).all<{question:number;choice:number;label:string}>()).results;expect(actual).toHaveLength(4900);for(const row of actual)expect(row.label).toBe(labels[row.question][row.choice])}
  meter.reset();const cold=new FormImports(meter.database,f.actor);expect((await cold.resume(job.id)).state).toBe('completed');limits(meter.stats)
  meter.reset();expect((await cold.undo(job.id)).state).toBe('undone');limits(meter.stats);await privateEmpty()
  expect(await env.DB.prepare('SELECT id FROM flows WHERE id=?').bind(review.flowId).first()).toBeNull();expect(await env.DB.prepare('SELECT target_id FROM form_import_native_epochs WHERE target_id=?').bind(review.flowId).first()).toBeNull()
},900_000)
contract(['IMPORT-002','IMPORT-004','FLOW-019'],'full legal statements dynamically gather fewer responses and preserve every cold-applied value',async()=>{
  const f=await importPrivacyFixture(),titles=Array.from({length:49},(_,q)=>String.fromCharCode(0x4e00+q).repeat(1000)),count=20
  const input={plannedAt,definition:JSON.stringify({title:'Legal native transport',fields:titles.map((title,q)=>({ref:`q${q}`,title,type:'legal'}))}),csv:Array.from({length:49},(_,q)=>`q${q}`).join(',')+',Submit Date\n'+Array.from({length:count},(_,i)=>Array(49).fill(i%2?'0':'1').join(',')+',2026-09-12 10:00:00').join('\n')}
  const meter=importTransportObserver(env.DB),service=new FormImports(meter.database,f.actor),review=await service.review(input);expect(review.rowErrors).toEqual([]);limits(meter.stats);meter.reset()
  let job=await service.commit(input,review.fingerprint,true);limits(meter.stats);expect(job.state).toBe('preparing');expect(job.checkpoint).toBe(0)
  meter.reset();job=await new FormImports(meter.database,f.actor).resume(job.id);limits(meter.stats);expect(job.checkpoint).toBeLessThan(10)
  while(job.state!=='completed'){meter.reset();job=await new FormImports(meter.database,f.actor).resume(job.id);limits(meter.stats);await privateEmpty()}
  const values=(await env.DB.prepare('SELECT a.value_json FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=?').bind(review.flowId).all<{value_json:string}>()).results;expect(values).toHaveLength(count*49)
  const actual=new Map<string,{yes:number;no:number}>();for(const row of values){const value=JSON.parse(row.value_json);expect(typeof value.accepted).toBe('boolean');const counts=actual.get(value.statement)??{yes:0,no:0};counts[value.accepted?'yes':'no']++;actual.set(value.statement,counts)}
  expect(actual.size).toBe(49);for(const title of titles)expect(actual.get(title)).toEqual({yes:10,no:10})
  do{meter.reset();job=await new FormImports(meter.database,f.actor).undo(job.id);limits(meter.stats);await privateEmpty()}while(job.state!=='undone')
  expect(await env.DB.prepare('SELECT id FROM flows WHERE id=?').bind(review.flowId).first()).toBeNull()
},900_000)
