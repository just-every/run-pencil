import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { hashToken, opaqueToken } from '../../src/base/operator-auth/crypto.mjs'
import { createWorkerApp, initializePencil } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import type { WorkerBindings } from '../../src/core/app/environment'

const receiver = (env as unknown as { AI_RECEIVER_ORIGIN: string }).AI_RECEIVER_ORIGIN
export const aiKey = 'synthetic-ai-key-canary-7f3e'
/** A direct OpenAI-compatible transport to the loopback provider edge. */
export const aiBindings = { AI_ENABLED: 'true', AI_MODEL: 'synthetic-model', AI_API_KEY: aiKey, AI_BASE_URL: `${receiver}/v1` }

type Captured = { path: string; authorization: string | null; body: string }
export const ai = {
  async reset(script: unknown[] = []) { await fetch(`${receiver}/__control/reset`, { method: 'POST', body: JSON.stringify({ script }) }) },
  async script(...script: unknown[]) { await fetch(`${receiver}/__control/script`, { method: 'POST', body: JSON.stringify({ script }) }) },
  async requests(): Promise<Captured[]> { return (await (await fetch(`${receiver}/__control/state`)).json() as { requests: Captured[] }).requests },
}
/** A Responses API answer whose one output text is the given analysis JSON. */
export const answer = (output: unknown, headers: Record<string, string> = {}) => ({ status: 200, headers, body: {
  id: 'resp_synthetic', status: 'completed', usage: { input_tokens: 1200, output_tokens: 300 },
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: typeof output === 'string' ? output : JSON.stringify(output) }] }],
} })
export const theme = (title: string, responseIds: string[], quotes: unknown[] = []) => ({ title, summary: `${title}, as analysed.`, responseIds, count: responseIds.length, quotes })
export const recommend = (title: string, themeIndexes: number[]) => ({ title, rationale: `Because of themes ${themeIndexes.join(', ')}.`, themeIndexes, confidence: 'medium', expectedImpact: 'high', effort: 'low' })

/** A fresh workspace whose published flow asks a long text, a short text (a name) and an email question. */
export async function analysisHttp(bindings: Partial<WorkerBindings> = aiBindings, label = crypto.randomUUID().slice(0, 8)) {
  const workspaceId = crypto.randomUUID(), operatorId = crypto.randomUUID(), sessionId = crypto.randomUUID(), token = opaqueToken(), now = new Date().toISOString()
  await env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES(?,'Analysis proof','UTC','09:00','17:00',?,?)").bind(workspaceId, now, now).run()
  await env.DB.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,'Analyst',0,?,?)").bind(operatorId, workspaceId, `${operatorId}@operators.example.test`, now, now).run()
  await env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,1,'native',?,?)").bind(sessionId, await hashToken(env.SESSION_SECRET, 'session', token), operatorId, Date.now(), Date.now() + 3600000).run()
  const platform = createPencilPlatform('http://localhost', { ...env, ...bindings } as WorkerBindings)
  const services = await initializePencil(platform)
  const app = createWorkerApp(undefined, platform)
  const call = (path: string, body?: unknown, method?: string) => app.request(`http://localhost${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { Host: 'localhost', Origin: 'http://localhost', Cookie: `operator_session_local_80=${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const slug = `analysis-${label}`
  const created = await services.flows.createDraftFlow({ workspaceId, slug, title: `Café feedback ${label}` })
  const draft = () => services.flows.getBuilderDraft(workspaceId, created.id)
  const add = async (step: Parameters<typeof services.flows.addDraftStep>[0]['step']) => services.flows.addDraftStep({ workspaceId, flowId: created.id, expectedVersion: (await draft()).flow.draftVersion, step })
  await add({ kind: 'question', questionType: 'long_text', prompt: 'What could we improve?', required: false })
  await add({ kind: 'question', questionType: 'short_text', prompt: 'Your name', required: false })
  await add({ kind: 'question', questionType: 'email', prompt: 'Email for follow-up', required: false })
  await add({ kind: 'completion', questionType: null, prompt: 'Thanks' })
  await services.flows.publishDraft({ workspaceId, flowId: created.id, expectedVersion: (await draft()).flow.draftVersion })
  const published = await draft()
  const step = (prompt: string) => published.steps.find(item => item.prompt === prompt)!
  const improve = step('What could we improve?'), name = step('Your name'), email = step('Email for follow-up')
  // A response submitted at once from a fresh session is held as suspected (quarantined); others are released.
  const respond = async (text: string, extra: { name?: string; email?: string; address?: string; quarantine?: boolean } = {}) => {
    const session = await services.responses.startPublicSession({ slug, deviceClass: 'mobile', source: 'direct', clientAddress: extra.address ?? `${slug}-${crypto.randomUUID()}` })
    if (!extra.quarantine) await env.DB.prepare('UPDATE respondent_sessions SET created_at = ? WHERE id = ?').bind(new Date(Date.now() - 5000).toISOString(), session.sessionId).run()
    await services.responses.submitPublicResponse({ slug, sessionId: session.sessionId, sessionToken: session.sessionToken, idempotencyKey: `key-${session.sessionId}`, honeypot: '', clientAddress: extra.address ?? `${slug}-${session.sessionId}`,
      answers: [{ stepId: improve.id, value: text }, ...(extra.name ? [{ stepId: name.id, value: extra.name }] : []), ...(extra.email ? [{ stepId: email.id, value: extra.email }] : [])] })
    const row = await env.DB.prepare('SELECT id, state FROM responses WHERE session_id = ?').bind(session.sessionId).first<{ id: string; state: string }>()
    expect(row?.state).toBe(extra.quarantine ? 'quarantined' : 'released')
    return row!.id
  }
  const revisionId = (await (await call(`/api/app/flows/${created.id}/results`)).json() as { revision: { id: string } }).revision.id
  // Answers and analysis name a question by its stable ID in the published revision.
  const questionId = async (prompt: string) => (await env.DB.prepare('SELECT stable_id AS id FROM flow_steps WHERE revision_id = ? AND prompt = ?').bind(revisionId, prompt).first<{ id: string }>())!.id
  const questions = { improve: await questionId('What could we improve?'), name: await questionId('Your name'), email: await questionId('Email for follow-up') }
  const request = async (body: Record<string, unknown> = {}) => {
    const response = await call('/api/app/analysis', { flowId: created.id, revisionId, ...body })
    expect(response.status, await response.clone().text()).toBe(201)
    return response.json() as Promise<any>
  }
  const detail = async (id: string) => (await call(`/api/app/analysis/${id}`)).json() as Promise<any>
  return { workspaceId, operatorId, flowId: created.id, revisionId, slug, questions, services, platform, call, respond, request, detail }
}
