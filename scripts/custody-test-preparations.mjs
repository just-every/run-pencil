import assert from 'node:assert/strict';
import { planD1ImportStream, prepareD1ImportStream, readD1ImportPreparation } from '../src/base/import-kit/src/d1/index.ts';
import { disconnectAt } from './custody-test-transport.mjs';
import { custodyContext } from './custody-test-targets.mjs';

export async function preparationRows(database, id) {
  const rows = {};
  for (const table of ['ik_d1_preparation_receipts', 'ik_d1_staging_headers']) {
    rows[table] = (await database.prepare(`SELECT * FROM ${table} WHERE stage_id=? ORDER BY rowid`).bind(id).all()).results;
  }
  return rows;
}

export async function preparationCustody(database, actor, namespace, source, mapping, interrupted = false) {
  const context = custodyContext(database, actor, namespace);
  const plan = await planD1ImportStream(source, mapping, context);
  const input = { ...context, reviewedFingerprint: plan.fingerprint, operationKey: namespace };
  let prepared;
  if (interrupted) {
    const fault = disconnectAt(database, queries => queries.some(sql => sql.startsWith('UPDATE ik_d1_staging SET sealed_revision=revision')));
    await assert.rejects(prepareD1ImportStream(source, mapping, { ...input, storage: { ...context.storage, database: fault.database } }));
    assert.equal(fault.disconnected, true);
    const pending = await database.prepare('SELECT id FROM ik_d1_staging WHERE destination=? AND operation_key=?').bind(actor.workspaceId, namespace).first();
    assert.ok(pending);
    prepared = await readD1ImportPreparation(pending.id, context);
  } else prepared = await prepareD1ImportStream(source, mapping, input);
  assert.equal(prepared.state, interrupted ? 'preparation-interrupted' : 'preparing'); assert.equal(prepared.checkpoint, 0);
  const stage = await database.prepare('SELECT * FROM ik_d1_staging WHERE id=?').bind(prepared.id).first();
  assert.ok(stage); assert.notEqual(stage.registered_revision, null); assert.equal(stage.sealed_revision, interrupted ? null : stage.revision);
  const rows = await preparationRows(database, prepared.id);
  assert.equal(rows.ik_d1_preparation_receipts.length, 1);
  assert.equal(rows.ik_d1_preparation_receipts[0].generation, stage.generation);
  assert.equal(rows.ik_d1_preparation_receipts[0].codec_id, null);
  assert.ok(rows.ik_d1_staging_headers.length > 0);
  assert.equal(rows.ik_d1_staging_headers.length, rows.ik_d1_preparation_receipts[0].header_chunks);
  const item = { namespace, source, plan, prepared, stage, rows };
  await verifyPreparationReadback(database, actor, item);
  return item;
}

export async function verifyPreparationReadback(database, actor, item) {
  assert.deepEqual(await database.prepare('SELECT * FROM ik_d1_staging WHERE id=?').bind(item.stage.id).first(), item.stage);
  assert.deepEqual(await preparationRows(database, item.stage.id), item.rows);
  assert.deepEqual(await readD1ImportPreparation(item.stage.id, custodyContext(database, actor, item.namespace)), item.prepared);
  assert.equal(await database.prepare('SELECT id FROM ik_d1_streams WHERE id=?').bind(item.stage.id).first(), null);
  assert.equal((await database.prepare('SELECT count(*) n FROM ik_jobs WHERE namespace=?').bind(item.namespace).first()).n, 0);
  assert.equal((await database.prepare('SELECT count(*) n FROM ik_targets WHERE destination=? AND instr(CAST(id AS BLOB),CAST(? AS BLOB))=1').bind(actor.workspaceId, `${item.namespace}:`).first()).n, 0);
}

export async function preparationTriggerCanaries(database, actor, item) {
  const execute = (sql, ...params) => database.batch([database.prepare(sql).bind(...params)]);
  const id = item.stage.id;
  await assert.rejects(execute('UPDATE ik_d1_preparation_receipts SET header_hash=header_hash WHERE stage_id=?', id), /IMPORT_PREPARATION_CHANGED/);
  await execute('UPDATE ik_d1_staging_headers SET body=body WHERE stage_id=?', id);
  const revised = await database.prepare('SELECT revision,registered_revision,sealed_revision FROM ik_d1_staging WHERE id=?').bind(id).first();
  assert.ok(revised.revision > item.stage.revision); assert.equal(revised.sealed_revision, null); assert.notEqual(revised.registered_revision, null);
  assert.equal((await readD1ImportPreparation(id, custodyContext(database, actor, item.namespace))).state, 'preparation-interrupted');
  await execute('UPDATE ik_d1_staging_index SET ordinal=ordinal WHERE stage_id=?', id);
  assert.equal((await database.prepare('SELECT registered_revision FROM ik_d1_staging WHERE id=?').bind(id).first()).registered_revision, null);
  assert.equal((await preparationRows(database, id)).ik_d1_staging_headers.length, 0);
  const header = item.rows.ik_d1_staging_headers[0];
  await assert.rejects(execute('INSERT INTO ik_d1_staging_headers(stage_id,ordinal,body,body_hash,body_size) VALUES(?,?,?,?,?)', id, header.ordinal, header.body, header.body_hash, header.body_size), /IMPORT_STAGE_INDEX_REQUIRED/);
  await execute('DELETE FROM ik_d1_staging WHERE id=?', id);
  assert.deepEqual(await preparationRows(database, id), { ik_d1_preparation_receipts: [], ik_d1_staging_headers: [] });
}
