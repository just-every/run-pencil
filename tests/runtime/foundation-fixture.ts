import { env, SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { initializePencil } from '../../src/core/app/worker'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
export async function foundationFixture(slug: string) {
  const platform = createPencilPlatform('http://localhost', env)
  const services = await initializePencil(platform)
  const workspace = await env.DB.prepare('SELECT id FROM workspaces LIMIT 1').first<{ id: string }>()
  const operatorId = crypto.randomUUID()
  const now = new Date().toISOString()
  await env.DB.prepare('INSERT INTO operators (id, workspace_id, email, display_name, is_setup_operator, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)').bind(operatorId, workspace!.id, `${slug}@operator.example.test`, 'Synthetic operator', now, now).run()
  const scope = { workspaceId: workspace!.id }
  const created = await services.flows.createDraftFlow({ ...scope, slug, title: `Synthetic ${slug}` })
  const flow = { ...scope, flowId: created.id }
  const draft = () => services.flows.getBuilderDraft(scope.workspaceId, created.id)
  const add = async (step: Parameters<typeof services.flows.addDraftStep>[0]['step']) => services.flows.addDraftStep({ ...flow, expectedVersion: (await draft()).flow.draftVersion, step })
  const publish = async () => services.flows.publishDraft({ ...flow, expectedVersion: (await draft()).flow.draftVersion })
  const start = () => services.responses.startPublicSession({ slug, deviceClass: 'mobile', source: 'direct', clientAddress: slug })
  const maturedTimes = new Map<string, number>()
  const loadTime = async (session: { sessionId: string; revisionId: string; loadTime: string }) => {
    const at = maturedTimes.get(session.sessionId)
    return at === undefined ? session.loadTime : issueLoadTime(env.SESSION_SECRET, session.revisionId, at)
  }
  const final = async (session: Awaited<ReturnType<typeof start>>, answers: Array<{ stepId: string; value: unknown }>, honeypot = '', invitationToken?: string) => services.responses.submitPublicResponse({ slug, sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: await loadTime(session), idempotencyKey: `key-${session.sessionId}`, prefillProof: session.flow.prefillProof, answers, honeypot, invitationToken, clientAddress: slug })
  const mature = async (id: string) => {
    const at = Date.now() - 5000
    const result = await env.DB.prepare('UPDATE respondent_sessions SET created_at = ? WHERE id = ?').bind(new Date(at).toISOString(), id).run()
    maturedTimes.set(id, at)
    return result
  }
  return { services, scope, flow, draft, add, publish, start, final, mature, loadTime, slug, operatorId, SELF }
}
