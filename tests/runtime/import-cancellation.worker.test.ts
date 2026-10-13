import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { FormImports } from '../../src/core/features/importing/service'
import { importPrivacyFixture } from './import-privacy-fixture'
import { cancellationHttp, cancellationRace } from './import-cancellation-fixture'
import { simpleJson, simpleCsv } from '../fixtures/form-import/fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const input = { definition: simpleJson, csv: simpleCsv, plannedAt: '2026-10-08T00:00:00.000Z' }
async function prepared() {
  const f = await importPrivacyFixture(), review = await f.imports.review(input)
  const job = await f.imports.commit(input, review.fingerprint, true)
  expect(job.state).toBe('preparing')
  return { ...f, review, job }
}
const actionPath = (kind: 'fingerprint' | 'job', id: string) => kind === 'fingerprint' ? '/cancel-staging' : `/${id}/undo`
const actionBody = (kind: 'fingerprint' | 'job', fingerprint: string) => kind === 'fingerprint' ? { fingerprint } : {}

for (const kind of ['fingerprint', 'job'] as const) for (const when of ['before-select', 'after-select'] as const) {
  contract(['IMPORT-002', 'IMPORT-004', 'BASE-ACCESS-004'], `${kind} cancellation reports publication winning ${when} through the real HTTP route`, async () => {
    const f = await prepared()
    let published: Awaited<ReturnType<FormImports['resume']>> | undefined
    const race = cancellationRace(when, async () => { published = await f.imports.resume(f.job.id) })
    const request = await cancellationHttp(race.database, f.actor)
    const response = await request(actionPath(kind, f.job.id), actionBody(kind, f.review.fingerprint))
    expect(race.observed).toEqual({ selected: true, atomicGuard: when === 'after-select' })
    expect(response.status).toBe(200)
    const result = await response.json() as { cancelled?: boolean; job?: unknown; error?: string }
    expect(result.error).not.toBe('IMPORT_EDIT_CONFLICT')
    if (kind === 'fingerprint') expect(result).toEqual({ cancelled: false, job: published })
    else expect(result).toEqual(published)
    expect(published).toMatchObject({ id: f.job.id, state: 'completed', checkpoint: 2, total: 2 })
    expect(await f.imports.status(f.job.id)).toEqual(published)
    expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_staging WHERE destination=?').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(f.review.flowId).first()).toEqual({ n: 1 })
    expect((await f.imports.undo(f.job.id)).state).toBe('undone')
  }, 90_000)
}

contract(['IMPORT-002', 'IMPORT-004', 'BASE-ACCESS-004'], 'fingerprint cancellation resolves already-published owned progress while foreign fingerprints remain no-ops', async () => {
  const f = await prepared(), other = await importPrivacyFixture()
  await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(f.actor.workspaceId, other.actor.operatorId).run()
  other.actor.workspaceId = f.actor.workspaceId
  const foreign = new FormImports(env.DB, other.actor)
  expect(await foreign.cancelStaging(f.review.fingerprint)).toEqual({ cancelled: true })
  expect((await f.imports.status(f.job.id)).state).toBe('preparing')
  const published = await f.imports.resume(f.job.id)
  expect(await f.imports.cancelStaging(f.review.fingerprint)).toEqual({ cancelled: false, job: published })
  expect(await foreign.cancelStaging(f.review.fingerprint)).toEqual({ cancelled: true })
  expect(await foreign.list()).toEqual([])
  await expect(foreign.status(f.job.id)).rejects.toThrow('not found')
  await expect(foreign.undo(f.job.id)).rejects.toThrow('not found')
  expect(await f.imports.cancelStaging('0'.repeat(64))).toEqual({ cancelled: true })
  expect(await f.imports.status(f.job.id)).toEqual(published)
  const wrongWorkspace = new FormImports(env.DB, { ...f.actor, workspaceId: crypto.randomUUID() })
  await expect(wrongWorkspace.cancelStaging(f.review.fingerprint)).rejects.toThrow('current operator session')
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), f.actor.id).run()
  await expect(f.imports.cancelStaging(f.review.fingerprint)).rejects.toThrow('current operator session')
}, 90_000)

for (const kind of ['fingerprint', 'job'] as const) {
  contract(['IMPORT-002', 'IMPORT-004', 'BASE-ACCESS-004'], `${kind} cancellation preserves current revocation after a stale private row and publication`, async () => {
    const f = await prepared()
    const race = cancellationRace('after-select', async () => {
      expect((await f.imports.resume(f.job.id)).state).toBe('completed')
      await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(), f.actor.id).run()
    })
    const request = await cancellationHttp(race.database, f.actor)
    const response = await request(actionPath(kind, f.job.id), actionBody(kind, f.review.fingerprint))
    expect(race.observed).toEqual({ selected: true, atomicGuard: true })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'VALIDATION_ERROR', message: 'A current operator session is required to cancel private import custody.' })
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE flow_id=?').bind(f.review.flowId).first()).toEqual({ n: 1 })
  }, 90_000)

  contract(['IMPORT-002', 'IMPORT-004'], `${kind} cancellation reports true private absence when another cancellation wins the guarded delete`, async () => {
    const f = await prepared()
    const race = cancellationRace('after-select', async () => { expect(await f.imports.cancelStaging(f.review.fingerprint)).toEqual({ cancelled: true }) })
    const imports = new FormImports(race.database, f.actor)
    const result = kind === 'fingerprint' ? await imports.cancelStaging(f.review.fingerprint) : await imports.undo(f.job.id)
    expect(race.observed).toEqual({ selected: true, atomicGuard: true })
    expect(result).toMatchObject(kind === 'fingerprint' ? { cancelled: true } : { id: f.job.id, state: 'cancelled', checkpoint: 0, total: 2 })
    expect(await f.imports.list()).toEqual([])
    expect(await env.DB.prepare('SELECT count(*) n FROM flows WHERE workspace_id=?').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
  }, 90_000)

  contract(['IMPORT-002', 'IMPORT-004'], `${kind} cancellation does not convert a changed private generation into success`, async () => {
    const f = await prepared()
    const race = cancellationRace('after-select', async () => { await env.DB.prepare('UPDATE ik_d1_staging SET revision=revision+1 WHERE id=?').bind(f.job.id).run() })
    const request = await cancellationHttp(race.database, f.actor)
    const response = await request(actionPath(kind, f.job.id), actionBody(kind, f.review.fingerprint))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'VALIDATION_ERROR', message: 'Private preparation changed during cancellation. Refresh import history before continuing.' })
    expect(race.observed).toEqual({ selected: true, atomicGuard: true })
    expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_staging WHERE id=?').bind(f.job.id).first()).toEqual({ n: 1 })
    expect(await env.DB.prepare('SELECT count(*) n FROM ik_d1_streams WHERE id=?').bind(f.job.id).first()).toEqual({ n: 0 })
    expect(await f.imports.cancelStaging(f.review.fingerprint)).toEqual({ cancelled: true })
  }, 90_000)

  contract(['IMPORT-002', 'IMPORT-004'], `${kind} cancellation cannot delete a replacement generation admitted before the private select`, async () => {
    const f = await prepared()
    let replacement: Awaited<ReturnType<FormImports['commit']>> | undefined
    const race = cancellationRace('before-select', async () => {
      expect(await f.imports.cancelStaging(f.review.fingerprint)).toEqual({ cancelled: true })
      replacement = await f.imports.commit(input, f.review.fingerprint, true)
    })
    const request = await cancellationHttp(race.database, f.actor)
    const response = await request(actionPath(kind, f.job.id), actionBody(kind, f.review.fingerprint))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'VALIDATION_ERROR', message: 'Private preparation changed during cancellation. Refresh import history before continuing.' })
    expect(race.observed).toEqual({ selected: true, atomicGuard: true })
    expect(replacement!.id).not.toBe(f.job.id)
    expect(await f.imports.status(replacement!.id)).toEqual(replacement)
    expect(await env.DB.prepare('SELECT count(*) n FROM flows WHERE workspace_id=?').bind(f.actor.workspaceId).first()).toEqual({ n: 0 })
    expect(await f.imports.cancelStaging(f.review.fingerprint)).toEqual({ cancelled: true })
  }, 90_000)

  contract(['IMPORT-002', 'IMPORT-004'], `${kind} cancellation reports a replacement generation that already won publication`, async () => {
    const f = await prepared()
    let published: Awaited<ReturnType<FormImports['resume']>> | undefined
    const race = cancellationRace('before-select', async () => {
      expect(await f.imports.cancelStaging(f.review.fingerprint)).toEqual({ cancelled: true })
      const replacement = await f.imports.commit(input, f.review.fingerprint, true)
      published = await f.imports.resume(replacement.id)
    })
    const request = await cancellationHttp(race.database, f.actor)
    const response = await request(actionPath(kind, f.job.id), actionBody(kind, f.review.fingerprint))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(kind === 'fingerprint' ? { cancelled: false, job: published } : published)
    expect(published!.id).not.toBe(f.job.id)
    expect(published!.state).toBe('completed')
    expect(await f.imports.status(published!.id)).toEqual(published)
    expect((await f.imports.undo(published!.id)).state).toBe('undone')
  }, 90_000)
}
