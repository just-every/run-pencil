import { expect } from 'vitest'
import { prepareImport } from '../../src/core/features/importing/prepare'
import { importContext } from '../../src/core/features/importing/service'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { createPencilServices } from '../../src/core/app/services'
import { custodyActor } from '../../scripts/custody-test-targets.mjs'
import { disconnectAt } from '../../scripts/custody-test-transport.mjs'
import { planD1ImportStream, createD1ImportStream, resumeD1ImportStream } from '../../src/base/import-kit/src/d1/index'
import type { WorkerBindings } from '../../src/core/app/environment'

export async function nativeCustodyFixture(database: D1Database, bindings: WorkerBindings) {
  const actor = await custodyActor(database)
  const prepared = prepareImport({
    definition: JSON.stringify({ title: 'Custody recovery form', fields: [{ ref: 'answer', type: 'short_text', title: 'Answer' }], thankyou_screens: [{ ref: 'end', title: 'Thanks' }] }),
    csv: 'Answer,Submit Date\nerased private answer,2026-09-12 10:03:00\nretained answer,2026-09-12 10:04:00\n',
    plannedAt: '2026-09-12T10:05:00.000Z',
  }, actor.workspaceId)
  expect(prepared.rowErrors).toEqual([])
  expect(prepared.responseCount).toBe(2)
  const context = { ...importContext(database, actor, prepared.namespace), batchSize: 1, maxBatches: 1 }
  const plan = await planD1ImportStream(prepared.source, prepared.mapping, context)
  const first = await createD1ImportStream(plan, { ...context, reviewedFingerprint: plan.fingerprint, operationKey: 'first-copy' })
  await resumeD1ImportStream(first.id, context)
  expect((await resumeD1ImportStream(first.id, context)).checkpoint).toBe(2)
  const responseRecord = prepared.source.records.find(record => record.kind === 'response')!
  const erasedId = prepared.mapping.map(responseRecord).effects[0].targetId
  expect(await database.prepare('SELECT source,notification_eligible FROM responses WHERE id=?').bind(erasedId).first()).toEqual({ source: 'imported', notification_eligible: 0 })
  const repeated = await createD1ImportStream(plan, { ...context, reviewedFingerprint: plan.fingerprint, operationKey: 'repeated-copy' })
  const privateSource = { ...prepared.source, records: [responseRecord] }
  const privatePlan = await planD1ImportStream(privateSource, prepared.mapping, context)
  const fault = disconnectAt(database, queries => queries.some(sql => sql.startsWith('INSERT INTO ik_d1_streams(')))
  await expect(createD1ImportStream(privatePlan, { ...context, storage: { ...context.storage, database: fault.database }, reviewedFingerprint: privatePlan.fingerprint, operationKey: 'private-copy' })).rejects.toThrow()
  expect(fault.disconnected).toBe(true)
  const stage = await database.prepare('SELECT * FROM ik_d1_staging WHERE destination=? AND operation_key=?').bind(actor.workspaceId, 'private-copy').first<{ id: string; revision: number; sealed_revision: number }>()
  expect(stage).not.toBeNull()
  expect(stage!.sealed_revision).toBe(stage!.revision)
  const services = createPencilServices(createPencilPlatform('http://localhost', { ...bindings, DB: database }))
  const input = { workspaceId: actor.workspaceId, operatorId: actor.operatorId, sessionId: actor.id, responseId: erasedId }
  return { actor, prepared, context, first, repeated, stage: stage!, plan, erasedId, services, input }
}
