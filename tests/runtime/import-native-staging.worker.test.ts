import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { importPrivacyFixture, allStoredData } from './import-privacy-fixture'
import { simpleJson, simpleCsv } from '../fixtures/form-import/fixture'
import { nativeImportStagingSchema } from '../../src/core/features/importing/native-staging-schema'
import { importTargets } from '../../src/core/features/importing/native'
import { importContext } from '../../src/core/features/importing/service'
import { nativeStageAtomic } from '../../src/base/import-kit/src/d1/native-staging-state'
import { guard, sql } from '../../src/base/import-kit/src/d1/database'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const input={definition:simpleJson,csv:simpleCsv,plannedAt:'2026-10-08T00:00:00.000Z'}
async function imported(){const f=await importPrivacyFixture(),review=await f.imports.review(input);let job=await f.imports.commit(input,review.fingerprint,true);while(job.state!=='completed')job=await f.imports.resume(job.id);return {...f,review,job}}

contract(['IMPORT-002','IMPORT-004','DATA-002'],'native mutation schema backfills prior imports without rewriting custody and removes erased target stamps',async()=>{
  const f=await imported(),before=await env.DB.prepare('SELECT * FROM ik_jobs ORDER BY id').all()
  const triggers=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'form_import_epoch_%'").all<{name:string}>()).results
  await env.DB.batch([...triggers.map(row=>env.DB.prepare(`DROP TRIGGER ${row.name}`)),...['form_import_native_publication_fences','form_import_native_epochs','form_import_native_clock'].map(table=>env.DB.prepare(`DROP TABLE ${table}`))])
  await env.DB.batch(nativeImportStagingSchema.map(query=>env.DB.prepare(query)))
  expect((await env.DB.prepare('SELECT * FROM ik_jobs ORDER BY id').all()).results).toEqual(before.results)
  expect((await env.DB.prepare('SELECT count(*) n FROM form_import_native_epochs').first<{n:number}>())!.n).toBe((await env.DB.prepare('SELECT count(*) n FROM form_import_targets').first<{n:number}>())!.n)
  expect((await f.imports.resume(f.job.id)).state).toBe('completed')
  const response=(await env.DB.prepare('SELECT id FROM responses WHERE flow_id=? LIMIT 1').bind(f.review.flowId).first<{id:string}>())!
  expect((await f.erase(response.id)).status).toBe(204)
  expect(await env.DB.prepare('SELECT * FROM form_import_native_epochs WHERE target_id=?').bind(response.id).first()).toBeNull()
  let job=await f.imports.undo(f.job.id);while(job.state!=='undone')job=await f.imports.undo(job.id)
  expect((await f.imports.undo(job.id)).state).toBe('undone')
  expect(await env.DB.prepare('SELECT * FROM form_import_native_epochs WHERE target_id=?').bind(f.review.flowId).first()).toBeNull()
},90_000)

for(const boundary of ['form_import_native_publication_fences','ik_d1_publication_fences'])for(const mutation of ['epoch','session'])contract(['IMPORT-002','IMPORT-004','BASE-ACCESS-004'],`native final checks roll back ${mutation} mutation during ${boundary} release`,async()=>{
  const f=await imported(),stageId=crypto.randomUUID(),row=(await env.DB.prepare('SELECT namespace FROM ik_jobs WHERE id=?').bind(f.job.id).first<{namespace:string}>())!
  const context=importContext(env.DB,f.actor,row.namespace),native=await importTargets.read(context.storage.database,f.actor.workspaceId,'form',f.review.flowId)
  const protection=importTargets.stagingPublication!(stageId,f.actor.workspaceId,[{kind:'form',id:f.review.flowId,present:true}])
  const before=await allStoredData(),mutationSql=mutation==='epoch'?`UPDATE form_import_native_epochs SET revision=revision+1 WHERE target_id='${f.review.flowId}'`:`UPDATE oa_sessions SET revoked_at=1 WHERE id='${f.actor.id}'`
  await env.DB.prepare(`CREATE TRIGGER fault_native_release AFTER DELETE ON ${boundary} BEGIN ${mutationSql};END`).run()
  try{
    await expect(nativeStageAtomic(context,'apply',[
      ...protection.protect,sql('INSERT INTO ik_d1_publication_fences(stream_id,job_id) VALUES(?,?)',stageId,f.job.id),
      ...importTargets.matchesParts!(native!,f.actor.workspaceId,'form',f.review.flowId).map(guard),...protection.seal,
      sql('UPDATE ik_d1_custody_revisions SET seal=? WHERE job_id=?',stageId,f.job.id),
    ],0,[...protection.release,sql('DELETE FROM ik_d1_publication_fences WHERE stream_id=?',stageId)],[...protection.final,sql('EXISTS(SELECT 1 FROM ik_d1_custody_revisions WHERE job_id=? AND seal=?)',f.job.id,stageId)])).rejects.toThrow(/malformed JSON|IMPORT_ATOMIC_GUARD/)
    expect(await allStoredData()).toBe(before)
  }finally{await env.DB.prepare('DROP TRIGGER fault_native_release').run()}
},90_000)
