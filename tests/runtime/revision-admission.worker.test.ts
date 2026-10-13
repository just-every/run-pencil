import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { createPencilServices } from '../../src/core/app/services'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { FlowRepository } from '../../src/core/features/flows/repository'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const restartServices = () => createPencilServices(createPencilPlatform('http://localhost', env))

async function revisions(slug: string) {
  const f = await foundationFixture(slug)
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Feedback', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Thanks' })
  const publish = async () => f.services.flows.publishDraft({ ...f.flow, expectedVersion: (await f.draft()).flow.draftVersion, targetCompletedResponses: 1 })
  const invite = async (suffix: string) => {
    const c = await f.services.distribution.contacts.save(f.scope.workspaceId, { name: 'Synthetic recipient', email: `${slug}-${suffix}@example.test` }) as { id: string }
    const launch = await f.services.distribution.launches.launch({ ...f.flow, contactIds: [c.id], commandKey: `${slug}-${suffix}`, operatorId: f.operatorId })
    return (await env.DB.prepare(`SELECT p.token, p.revision_id AS revisionId, d.id AS deliveryId FROM invitation_participants p JOIN mail_deliveries d ON d.participant_id = p.id WHERE p.launch_id = ?`).bind(launch.id).first<{ token: string; revisionId: string; deliveryId: string }>())!
  }
  await publish()
  const old = await invite('old'), oldDirect = await f.start()
  const oldInvited = await f.services.responses.startPublicSession({ slug, deviceClass: 'desktop', source: 'invitation', invitationToken: old.token, clientAddress: slug })
  await publish()
  const current = await invite('current'), currentDirect = await f.start()
  for (const s of [oldDirect, oldInvited, currentDirect]) await f.mature(s.sessionId)
  const answer = (s: typeof oldDirect) => [{ stepId: s.flow.steps[0].id, value: 'Synthetic answer' }]
  return { ...f, old, oldDirect, oldInvited, current, currentDirect, answer }
}

for (const closing of ['old', 'current'] as const) for (const reason of ['target', 'deadline'] as const) {
  contract(['FLOW-010', 'FLOW-017', 'FLOW-018', 'RESP-009', 'DIST-004'], `${reason} closure of ${closing} revision preserves the other pinned revision after service reconstruction`, async () => {
    const f = await revisions(`admission-${closing}-${reason}`)
    const closed = closing === 'old' ? f.old : f.current
    const survivor = closing === 'old' ? f.current : f.old
    const closingSession = closing === 'old' ? f.oldDirect : f.currentDirect
    const survivorSession = closing === 'old' ? f.currentDirect : f.oldDirect
    if (reason === 'target') expect(await f.final(closingSession, f.answer(closingSession))).toMatchObject({ disposition: 'released' })
    else {
      const now = new Date().toISOString()
      await env.DB.prepare('UPDATE flow_revisions SET deadline_at = ? WHERE id = ?').bind(now, closed.revisionId).run()
      const platform = createPencilPlatform('http://localhost', env)
      await new FlowRepository(platform.database, env.DB).closeExpiredRevision(closed.revisionId, now)
    }
    const fresh = restartServices()
    expect(await env.DB.prepare('SELECT admission_closed_at FROM flow_revisions WHERE id = ?').bind(survivor.revisionId).first()).toEqual({ admission_closed_at: null })
    await expect(fresh.responses.invitationFlow(closed.token)).rejects.toThrow('no longer accepting')
    expect(await fresh.distribution.deliveries.prepare(closed.deliveryId, 'https://example.test')).toBeNull()
    expect((await fresh.responses.invitationFlow(survivor.token)).revision.id).toBe(survivor.revisionId)
    expect(await fresh.distribution.deliveries.prepare(survivor.deliveryId, 'https://example.test')).toMatchObject({ ordinal: 1 })
    const invited = await fresh.responses.startPublicSession({ slug: f.slug, deviceClass: 'mobile', source: 'invitation', invitationToken: survivor.token, clientAddress: f.slug })
    expect(invited.revisionId).toBe(survivor.revisionId)
    if (closing === 'current') await expect(f.start()).rejects.toThrow('no longer accepting')
    else expect((await f.start()).revisionId).toBe(survivor.revisionId)
    // A direct session that already interacted with the older revision stays valid.
    expect(await f.final(survivorSession, f.answer(survivorSession))).toMatchObject({ disposition: 'released' })
    // Its own target now closes it too, and no later pinned completion sneaks in.
    await f.mature(invited.sessionId)
    await expect(f.final(invited, f.answer(invited), '', survivor.token)).rejects.toThrow('no longer accepting')
    expect((await env.DB.prepare("SELECT revision_id, count(*) AS n FROM responses WHERE flow_id = ? GROUP BY revision_id").bind(f.flow.flowId).all()).results.length).toBe(reason === 'target' ? 2 : 1)
  }, 60_000)
}

contract(['FLOW-009', 'FLOW-017', 'FLOW-018'], 'active invited older session can finish after current closure; manual closure and archive revoke every remaining revision', async () => {
  for (const global of ['manual', 'archive'] as const) {
    const f = await revisions(`admission-global-${global}`)
    await f.final(f.currentDirect, f.answer(f.currentDirect))
    // A current target made flow.status closed. The explicit global operation
    // must still close the older open revision, without depending on that status.
    if (global === 'manual') await f.services.flows.closeFlow(f.scope.workspaceId, f.flow.flowId, f.operatorId)
    else await f.services.flows.archiveFlow(f.scope.workspaceId, f.flow.flowId, f.operatorId)
    const fresh = restartServices()
    await expect(fresh.responses.invitationFlow(f.old.token)).rejects.toThrow(global === 'archive' ? 'no longer available' : 'no longer accepting')
    await expect(f.final(f.oldInvited, f.answer(f.oldInvited), '', f.old.token)).rejects.toThrow('no longer accepting')
    await expect(f.final(f.oldDirect, f.answer(f.oldDirect))).rejects.toThrow('no longer accepting')
    expect(await fresh.distribution.deliveries.prepare(f.old.deliveryId, 'https://example.test')).toBeNull()
    expect(await env.DB.prepare("SELECT count(*) AS n FROM flow_revisions WHERE flow_id = ? AND state = 'published' AND admission_closed_at IS NULL").bind(f.flow.flowId).first()).toEqual({ n: 0 })
  }
  const f = await revisions('admission-old-active-invitation')
  await f.final(f.currentDirect, f.answer(f.currentDirect))
  const fresh = restartServices()
  expect(await fresh.responses.submitPublicResponse({ slug: f.slug, sessionId: f.oldInvited.sessionId, sessionToken: f.oldInvited.sessionToken, invitationToken: f.old.token, answers: f.answer(f.oldInvited), idempotencyKey: 'old-active', clientAddress: f.slug })).toMatchObject({ disposition: 'released' })
}, 60_000)
