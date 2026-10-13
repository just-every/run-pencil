import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { archiveFixture } from './archive-fixture'
import { restoreStatements } from '../../scripts/deployment-data-sql.mjs'
import { generation } from '../../src/core/features/reporting/cursor'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(async()=> {await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__);await applyD1Migrations(env.IMPORT_SECOND,__PENCIL_CORE_MIGRATIONS__)})
async function collected(slug:string,mature=false) {
  const f=await foundationFixture(slug)
  await f.add({kind:'question',questionType:'short_text',prompt:'Retained question',required:false})
  await f.add({kind:'completion',questionType:null,prompt:'Done'})
  await f.publish();const draft=await f.draft(),session=await f.start()
  if(mature) await f.mature(session.sessionId)
  const receipt=await f.final(session,[{stepId:draft.steps[0].id,value:'Exact 😀\0 answer'}])
  return {...f,receipt}
}
contract(['RESP-018','LEDG-002','BASE-ACCESS-004','BASE-OPS-003'], 'quarantine release acknowledges the exact response transition despite reporting trigger writes',async()=> {
  const f=await collected('reporting-release-transition')
  expect(f.receipt.disposition).toBe('quarantined')
  const input={workspaceId:f.scope.workspaceId,responseId:f.receipt.responseId,operatorId:f.operatorId}
  await expect(f.services.responses.releaseQuarantinedResponse({...input,workspaceId:'foreign-workspace'})).rejects.toThrow(/does not exist/)
  expect(await env.DB.prepare('SELECT state FROM responses WHERE id=?').bind(input.responseId).first()).toEqual({state:'quarantined'})
  const before=await generation(env.DB,input.workspaceId)
  await expect(f.services.responses.releaseQuarantinedResponse(input)).resolves.toBeUndefined()
  expect(await env.DB.prepare('SELECT state,released_by_operator_id AS actor FROM responses WHERE id=?').bind(input.responseId).first()).toEqual({state:'released',actor:f.operatorId})
  expect(await generation(env.DB,input.workspaceId)).toBeGreaterThan(before)
  await expect(f.services.responses.releaseQuarantinedResponse(input)).rejects.toThrow(/does not exist/)
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_entries WHERE subject_id=? AND kind='response.quarantine-released'").bind(input.responseId).first()).toEqual({n:1})
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id=?').bind(input.responseId).first()).toEqual({n:1})
})
contract(['DATA-001','BASE-DATA-001','LEDG-004'], 'full native archive restoration preserves anonymous reporting metadata and every retained table',async()=> {
  const f=await collected('reporting-full-restore',true)
  const archive=await archiveFixture(env.DB,__PENCIL_CORE_MIGRATIONS__)
  const table=(name:string)=>archive.payload.tables.find(row=>row.name===name)!
  expect(table('reporting_generations').columns).toEqual(['workspace_id','generation'])
  expect(table('reporting_changes').columns).toEqual(['workspace_id','flow_id','eligible_at','generation'])
  expect(table('reporting_changes').rows.length).toBeGreaterThan(0)
  const toHex=(value:string)=>[...atob(value)].map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join('')
  const statements=restoreStatements(archive,JSON.parse(archive.payload.schema),toHex)
  await env.IMPORT_SECOND.batch(statements.map(({sql,params=[]}:{sql:string;params?:unknown[]})=>env.IMPORT_SECOND.prepare(sql).bind(...params)))
  expect(await archiveFixture(env.IMPORT_SECOND,__PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  expect((await env.IMPORT_SECOND.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  expect(await env.IMPORT_SECOND.prepare('SELECT value_json FROM response_answers WHERE response_id=?').bind(f.receipt.responseId).first()).toEqual({value_json:JSON.stringify('Exact 😀\0 answer')})
  const before=await generation(env.IMPORT_SECOND,f.scope.workspaceId)
  await env.IMPORT_SECOND.prepare('UPDATE response_answers SET value_json=value_json WHERE response_id=?').bind(f.receipt.responseId).run()
  expect(await generation(env.IMPORT_SECOND,f.scope.workspaceId)).toBeGreaterThan(before)
})
