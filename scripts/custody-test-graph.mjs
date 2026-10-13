import { preparationCustody } from './custody-test-preparations.mjs';
import { expectedStreamOrigins, readStreamOrigins } from './custody-test-origins.mjs';
import assert from 'node:assert/strict';
import { canonicalJson, sha256, planD1Import, createD1ImportJob, applyD1ImportBatches, undoD1Import,
  readD1ImportUndoReport, readD1ImportOriginals, planD1ImportStream, createD1ImportStream,
  resumeD1ImportStream, eraseD1ImportTarget } from '../src/base/import-kit/src/d1/index.ts';
import { custodyActor, custodyContext, custodyTargets } from './custody-test-targets.mjs';
import { disconnectAt } from './custody-test-transport.mjs';

export function custodySource(namespace, values) {
  const body = canonicalJson(values), artifact = { name: 'normalized.json', sha256: sha256(body), size: new TextEncoder().encode(body).length, original: { status: 'unavailable', reason: 'not-supplied' } };
  return { artifacts: [artifact], diagnostics: [], records: values.map((value, index) => ({ namespace, kind: 'record', sourceId: String(index),
    payload: value, payloadHash: sha256(canonicalJson(value)), artifactHash: artifact.sha256, location: { artifact: artifact.name, row: index + 1 } })) };
}
export const custodyMapping = { version: 'custody-test-v1', map: record => ({ effects: [{ targetKind: 'record', targetId: `${record.namespace}:${record.sourceId}`, value: record.payload }] }) };

export async function interruptedCustody(database, actor, namespace, values, phase = 'sealed') {
  const context = custodyContext(database, actor, namespace), source = custodySource(namespace, values);
  const plan = await planD1ImportStream(source, custodyMapping, context);
  const transport = disconnectAt(database, queries => queries.some(sql => phase === 'sealed'
    ? sql.startsWith('INSERT INTO ik_d1_streams(') : sql.includes('INSERT INTO ik_d1_staging_chunks(')));
  await assert.rejects(createD1ImportStream(plan, { ...context, storage: { ...context.storage, database: transport.database }, reviewedFingerprint: plan.fingerprint, operationKey: namespace }));
  assert.equal(transport.disconnected, true);
  const stage = await database.prepare('SELECT * FROM ik_d1_staging WHERE destination=? AND operation_key=?').bind(actor.workspaceId, namespace).first();
  assert.ok(stage);
  assert.notEqual(stage.registered_revision, null);
  if (phase === 'sealed') assert.equal(stage.sealed_revision, stage.revision);
  else assert.equal(stage.sealed_revision, null);
  return { stage, plan, source, namespace };
}

export async function custodyGraph(database) {
  const actor = await custodyActor(database), namespace = `stream-${crypto.randomUUID()}`;
  const context = custodyContext(database, actor, namespace), source = custodySource(namespace, [
    { answer: 'erased private value' }, { answer: 'retained\u0000😀', score: 1.25 }, { answer: 'remaining', accepted: false },
  ]);
  const plan = await planD1ImportStream(source, custodyMapping, context);
  const created = await createD1ImportStream(plan, { ...context, reviewedFingerprint: plan.fingerprint, operationKey: namespace });
  const partial = await resumeD1ImportStream(created.id, context);
  assert.equal(partial.state, 'applying'); assert.equal(partial.checkpoint, 1);
  const erasedId = `${namespace}:0`;
  const erased = await eraseD1ImportTarget('record', erasedId, custodyTargets.remove(actor.workspaceId, 'record', erasedId), context);
  assert.equal(erased.erasedRecords, 1);
  const resumed = await resumeD1ImportStream(created.id, context);
  assert.equal(resumed.state, 'applying'); assert.equal(resumed.checkpoint, 2);

  const ordinaryNamespace = `ordinary-${crypto.randomUUID()}`, ordinaryContext = { ...custodyContext(database, actor, ordinaryNamespace), reversalPolicy: 'preserve-conflicts' };
  const ordinarySource = custodySource(ordinaryNamespace, [{ answer: 'large retained normalized value '.repeat(6000) }]);
  const ordinaryPlan = await planD1Import(ordinarySource, custodyMapping, ordinaryContext);
  let ordinary = await createD1ImportJob(ordinaryPlan, { ...ordinaryContext, reviewedFingerprint: ordinaryPlan.fingerprint, operationKey: ordinaryNamespace });
  ordinary = await applyD1ImportBatches(ordinary.id, ordinaryContext);
  assert.equal(ordinary.state, 'completed');
  const target = await custodyTargets.read(database, actor.workspaceId, 'record', `${ordinaryNamespace}:0`);
  await database.batch(custodyTargets.write({ ...target, value: { answer: 'later native edit' } }).map(({ sql, params }) => database.prepare(sql).bind(...params)));
  ordinary = await undoD1Import(ordinary.id, ordinaryContext);
  assert.equal(ordinary.state, 'undone');
  const report = await readD1ImportUndoReport(ordinary.id, ordinaryContext);
  assert.equal(report.dispositions.length, 1); assert.equal(report.dispositions[0].reason, 'edited');
  assert.ok((await database.prepare('SELECT count(*) n FROM ik_d1_plan_chunks WHERE job_id=?').bind(ordinary.id).first()).n > 0);
  assert.equal((await database.prepare('SELECT count(*) n FROM ik_d1_creation_plans').first()).n, 0);
  assert.equal((await database.prepare('SELECT version FROM ik_original_sets WHERE job_id=?').bind(ordinary.id).first()).version, 3);
  assert.ok((await readD1ImportOriginals(ordinary.id, ordinaryContext)).every(row => row.original.status === 'unavailable'));
  const sealed = await interruptedCustody(database, actor, `sealed-${crypto.randomUUID()}`, [{ answer: 'private sealed value' }]);
  const interrupted = await interruptedCustody(database, actor, `interrupted-${crypto.randomUUID()}`, [{ answer: 'private pending value' }], 'registered');
  const origins = await expectedStreamOrigins(database, partial.id);
  assert.ok(origins.length > 0);
  assert.deepEqual(await readStreamOrigins(database, partial.id), origins);
  const preparationNamespace = `preparation-${crypto.randomUUID()}`;
  const preparation = await preparationCustody(database, actor, preparationNamespace, custodySource(preparationNamespace, [{ answer: 'private normalized preparation\u0000😀' }]), custodyMapping);
  const interruptedNamespace = `preparation-interrupted-${crypto.randomUUID()}`;
  const preparationInterrupted = await preparationCustody(database, actor, interruptedNamespace, custodySource(interruptedNamespace, [{ answer: 'private interrupted preparation' }]), custodyMapping, true);
  return { preparation, preparationInterrupted, actor, namespace, plan, source, streamId: partial.id, erasedId, ordinaryId: ordinary.id, ordinaryNamespace, report, sealed, interrupted, origins };
}
