import { env, SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { initializePencil } from '../../src/core/app/worker'
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
  const final = (session: Awaited<ReturnType<typeof start>>, answers: Array<{ stepId: string; value: unknown }>, honeypot = '', invitationToken?: string) => services.responses.submitPublicResponse({ slug, sessionId: session.sessionId, sessionToken: session.sessionToken, idempotencyKey: `key-${session.sessionId}`, answers, honeypot, invitationToken, clientAddress: slug })
  const mature = async (id: string) => env.DB.prepare('UPDATE respondent_sessions SET created_at = ? WHERE id = ?').bind(new Date(Date.now() - 5000).toISOString(), id).run()
  return { services, scope, flow, draft, add, publish, start, final, mature, slug, operatorId, SELF }
}
