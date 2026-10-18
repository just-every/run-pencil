import { matureLoad } from './load-time-fixture'
import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { hashToken, opaqueToken } from '../../src/base/operator-auth/crypto.mjs'
import { createWorkerApp, initializePencil } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import type { WorkerBindings } from '../../src/core/app/environment'

type Call = (path: string, body?: unknown, options?: { auth?: boolean; method?: string; origin?: string }) => Promise<Response>

async function operator(workspaceId: string, name: string) {
  const operatorId = crypto.randomUUID(), sessionId = crypto.randomUUID(), token = opaqueToken(), now = new Date().toISOString()
  await env.DB.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,?,0,?,?)").bind(operatorId, workspaceId, `${operatorId}@operators.example.test`, name, now, now).run()
  await env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,1,'native',?,?)").bind(sessionId, await hashToken(env.SESSION_SECRET, 'session', token), operatorId, Date.now(), Date.now() + 3600000).run()
  return { operatorId, sessionId, token }
}

/** A fresh workspace with two operators and a published flow whose results hold real released responses. */
export async function actionsHttp(bindings: Partial<WorkerBindings> = {}, label = crypto.randomUUID().slice(0, 8)) {
  const workspaceId = crypto.randomUUID(), now = new Date().toISOString()
  await env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES(?,'Actions proof','UTC','09:00','17:00',?,?)").bind(workspaceId, now, now).run()
  const lead = await operator(workspaceId, 'Lead operator'), owner = await operator(workspaceId, 'Owning operator')
  const platform = createPencilPlatform('http://localhost', { ...env, ...bindings } as WorkerBindings)
  const services = await initializePencil(platform)
  const app = createWorkerApp(undefined, platform)
  const as = (token: string): Call => (path, body, options = {}) => app.request(`http://localhost${path}`, {
    method: options.method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { Host: 'localhost', Origin: options.origin ?? 'http://localhost', Cookie: options.auth === false ? '' : `operator_session_local_80=${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const call = as(lead.token)
  const slug = `actions-${label}`
  const created = await services.flows.createDraftFlow({ workspaceId, slug, title: `Café visit ${label}` })
  const draft = () => services.flows.getBuilderDraft(workspaceId, created.id)
  const add = async (step: Parameters<typeof services.flows.addDraftStep>[0]['step']) => services.flows.addDraftStep({ workspaceId, flowId: created.id, expectedVersion: (await draft()).flow.draftVersion, step })
  await add({ kind: 'question', questionType: 'single_choice', prompt: 'How was the wait?', required: true, choices: [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Too long' }] })
  await add({ kind: 'question', questionType: 'long_text', prompt: 'Anything else?', required: false })
  await add({ kind: 'completion', questionType: null, prompt: 'Thanks' })
  await services.flows.publishDraft({ workspaceId, flowId: created.id, expectedVersion: (await draft()).flow.draftVersion })
  const published = await draft()
  const choiceStep = published.steps.find(step => step.prompt === 'How was the wait?')!, commentStep = published.steps.find(step => step.prompt === 'Anything else?')!
  const respond = async (choiceLabel: 'Short' | 'Too long', text: string) => {
    const session = await services.responses.startPublicSession({ slug, deviceClass: 'mobile', source: 'direct', clientAddress: `${slug}-${crypto.randomUUID()}` })
    await matureLoad(session, 5000)
    const option = published.choices.find(item => item.stepId === choiceStep.id && item.label === choiceLabel)!
    await services.responses.submitPublicResponse({ slug, sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: session.loadTime, idempotencyKey: `key-${session.sessionId}`, answers: [{ stepId: choiceStep.id, value: option.id }, { stepId: commentStep.id, value: text }], honeypot: '', clientAddress: `${slug}-${session.sessionId}` })
  }
  const revisionId = (await call(`/api/app/flows/${created.id}/results`).then(response => response.json() as Promise<{ revision: { id: string } }>)).revision.id
  const input = (overrides: Record<string, unknown> = {}) => ({
    title: 'Shorten the wait at the counter', rationale: 'Most visitors said the wait was too long.', ownerOperatorId: owner.operatorId, reviewDate: '2026-12-01',
    metric: { name: 'Visitors saying the wait was short', unit: 'percent', direction: 'increase', baselineValue: 33, baselineSource: 'Revision 1 results', baselineObservedAt: '2026-10-12T09:00:00.000Z' },
    evidence: { flowId: created.id, revisionId, questionId: choiceStep.id }, ...overrides,
  })
  const create = async (overrides: Record<string, unknown> = {}) => {
    const response = await call('/api/app/actions', input(overrides))
    expect(response.status, await response.clone().text()).toBe(201)
    return response.json() as Promise<{ id: string; version: number; state: string } & Record<string, any>>
  }
  return { workspaceId, lead, owner, call, as, services, app, flowId: created.id, revisionId, choiceStepId: choiceStep.id, respond, input, create, operator: (name: string) => operator(workspaceId, name) }
}

export async function rows(table: string, column: string, value: string) {
  return (await env.DB.prepare(`SELECT * FROM ${table} WHERE ${column} = ?`).bind(value).all()).results
}

export async function everyStoredValue() {
  const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all<{ name: string }>()).results
  const values: string[] = []
  for (const { name } of tables) for (const row of (await env.DB.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all()).results) values.push(`${name}:${JSON.stringify(row)}`)
  return values
}
