import { verifyPreparationReadback, preparationTriggerCanaries } from './custody-test-preparations.mjs';
import { readStreamOrigins } from './custody-test-origins.mjs';
import assert from 'node:assert/strict';
import { readD1ImportStream, readD1ImportUndoReport } from '../src/base/import-kit/src/d1/index.ts';
import { custodyContext } from './custody-test-targets.mjs';
const execute = (db, sql, ...params) => db.batch([db.prepare(sql).bind(...params)]);

export async function verifyCustodyReadback(db, graph) {
  await verifyPreparationReadback(db, graph.actor, graph.preparation);
  await verifyPreparationReadback(db, graph.actor, graph.preparationInterrupted);
  const stream = await readD1ImportStream(graph.streamId, custodyContext(db, graph.actor, graph.namespace));
  assert.equal(stream.state, 'applying'); assert.equal(stream.erasedRecords, 1);
  assert.deepEqual(await readStreamOrigins(db, graph.streamId), graph.origins);
  assert.equal(await db.prepare('SELECT job_id FROM ik_d1_stream_origins WHERE job_id=?').bind(graph.ordinaryId).first(), null);
  const report = await readD1ImportUndoReport(graph.ordinaryId, custodyContext(db, graph.actor, graph.ordinaryNamespace));
  assert.deepEqual(report, graph.report);
  const versions = (await db.prepare('SELECT DISTINCT version FROM ik_original_sets ORDER BY version').all()).results;
  assert.deepEqual(versions.map(row => row.version), [3, 4]);
  for (const item of [graph.sealed, graph.interrupted]) {
    assert.deepEqual(await db.prepare('SELECT * FROM ik_d1_staging WHERE id=?').bind(item.stage.id).first(), item.stage);
  }
  assert.equal((await db.prepare('SELECT count(*) n FROM ik_d1_creation_plans').first()).n, 0);
  for (const table of ['ik_d1_publication_fences', 'form_import_native_publication_fences']) assert.equal((await db.prepare(`SELECT count(*) n FROM ${table}`).first()).n, 0);
  for (const table of ['ik_d1_custody_revisions', 'ik_d1_custody_states']) {
    const row = await db.prepare(`SELECT revision FROM ${table} WHERE job_id=?`).bind(graph.ordinaryId).first();
    assert.ok(row && Number.isSafeInteger(row.revision) && row.revision >= 0);
  }
  assert.ok((await db.prepare('SELECT count(*) n FROM ik_d1_erased_sources').first()).n > 0);
  assert.ok((await db.prepare('SELECT count(*) n FROM ik_d1_erased_targets').first()).n > 0);
}

// Deliberate mutations run only after exact replay and valid kit readback have
// passed. These disposable copies prove restored triggers are live again.
export async function custodyTriggerCanaries(db, graph) {
  await preparationTriggerCanaries(db, graph.actor, graph.preparation);
  const jobId = graph.ordinaryId, receipt = crypto.randomUUID();
  const state = await db.prepare('SELECT revision FROM ik_d1_custody_states WHERE job_id=?').bind(jobId).first();
  await assert.rejects(execute(db, 'UPDATE ik_d1_custody_states SET revision=revision WHERE job_id=?', jobId));
  await assert.rejects(execute(db, 'DELETE FROM ik_d1_custody_states WHERE job_id=?', jobId));
  await assert.rejects(execute(db, 'UPDATE ik_d1_custody_revisions SET seal=? WHERE job_id=?', receipt, jobId));
  await execute(db, 'INSERT INTO ik_d1_publication_fences(stream_id,job_id) VALUES(?,?)', receipt, jobId);
  await execute(db, 'UPDATE ik_d1_custody_revisions SET seal=? WHERE job_id=?', receipt, jobId);
  await assert.rejects(execute(db, 'UPDATE ik_jobs SET checkpoint=checkpoint WHERE id=?', jobId));
  await assert.rejects(execute(db, 'UPDATE ik_d1_custody_states SET revision=revision+1 WHERE job_id=?', jobId));
  await execute(db, 'DELETE FROM ik_d1_publication_fences WHERE stream_id=?', receipt);
  await execute(db, 'UPDATE ik_jobs SET checkpoint=checkpoint WHERE id=?', jobId);
  assert.equal((await db.prepare('SELECT seal FROM ik_d1_custody_revisions WHERE job_id=?').bind(jobId).first()).seal, null);
  assert.ok((await db.prepare('SELECT revision FROM ik_d1_custody_states WHERE job_id=?').bind(jobId).first()).revision > state.revision);
  await execute(db, 'INSERT INTO ik_d1_plan_chunks(job_id,ordinal,body) SELECT job_id,ordinal+1000,body FROM ik_d1_plan_chunks WHERE job_id=? ORDER BY ordinal LIMIT 1', graph.ordinaryId);
  assert.equal((await db.prepare('SELECT count(*) n FROM ik_d1_creation_plans WHERE job_id=?').bind(graph.ordinaryId).first()).n, 1);
  await assert.rejects(execute(db, "UPDATE ik_d1_creation_plans SET body=body||'changed' WHERE job_id=?", graph.ordinaryId));
  await assert.rejects(execute(db, 'DELETE FROM ik_d1_creation_plans WHERE job_id=?', graph.ordinaryId));
  await execute(db, 'UPDATE ik_d1_creation_plans SET released=1 WHERE job_id=?', graph.ordinaryId);
  await execute(db, 'DELETE FROM ik_d1_creation_plans WHERE job_id=?', graph.ordinaryId);
  await execute(db, 'DELETE FROM ik_d1_plan_chunks WHERE job_id=? AND ordinal>=1000', graph.ordinaryId);

  const page = await db.prepare('SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? ORDER BY ordinal LIMIT 1').bind(graph.streamId).first();
  assert.ok(await db.prepare('SELECT job_id FROM ik_d1_indexed_jobs WHERE job_id=?').bind(page.job_id).first());
  await execute(db, 'UPDATE ik_d1_plan_index SET ordinal=ordinal WHERE job_id=?', page.job_id);
  assert.equal(await db.prepare('SELECT job_id FROM ik_d1_indexed_jobs WHERE job_id=?').bind(page.job_id).first(), null);
  await execute(db, 'UPDATE ik_d1_stream_pages SET ordinal=ordinal WHERE stream_id=?', graph.streamId);
  assert.equal((await db.prepare('SELECT state FROM ik_d1_streams WHERE id=?').bind(graph.streamId).first()).state, 'invalid');

  const id = graph.sealed.stage.id;
  await assert.rejects(execute(db, "UPDATE ik_d1_staging SET generation=generation||'changed' WHERE id=?", id));
  await execute(db, 'UPDATE ik_d1_staging_chunks SET body=body WHERE stage_id=?', id);
  const changed = await db.prepare('SELECT revision,registered_revision,sealed_revision FROM ik_d1_staging WHERE id=?').bind(id).first();
  assert.ok(changed.revision > graph.sealed.stage.revision); assert.equal(changed.sealed_revision, null); assert.notEqual(changed.registered_revision, null);
  await execute(db, 'UPDATE ik_d1_staging_index SET ordinal=ordinal WHERE stage_id=?', id);
  assert.equal((await db.prepare('SELECT registered_revision FROM ik_d1_staging WHERE id=?').bind(id).first()).registered_revision, null);
  for (const table of ['ik_d1_staging_chunks', 'ik_d1_staging_originals']) assert.equal((await db.prepare(`SELECT count(*) n FROM ${table} WHERE stage_id=?`).bind(id).first()).n, 0);
}
