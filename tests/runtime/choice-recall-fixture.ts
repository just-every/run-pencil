import { env, SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import type { BuilderDraft } from '../../src/core/app/api'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { devKeyHeaders } from '../helpers/dev-key.mjs'

export async function authoringClient() {
  let cookie = '', serial = 0
  const request = (path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST') => SELF.fetch('http://localhost' + path, {
    method, headers: { cookie, Host: 'localhost', Origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `198.18.217.${++serial % 250}` },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), redirect: 'manual',
  })
  const call = async <T,>(path: string, data?: unknown, method?: string): Promise<T> => {
    const response = await request(path, data, method)
    expect(response.ok, response.ok ? path : `${path}: ${await response.clone().text()}`).toBe(true)
    return response.status === 204 ? undefined as T : response.json<T>()
  }
  await call('/health')
  const owner = await env.DB.prepare('SELECT email FROM operators ORDER BY created_at,id LIMIT 1').first<{ email: string }>()
  await call('/auth/magic-link', { email: owner!.email })
  const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), owner!.email)
  const login = await request('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
  expect(login.status).toBe(303); cookie = login.headers.get('set-cookie')!.split(';')[0]
  const create = async (title: string) => {
    const slug = 'northstar-' + crypto.randomUUID().slice(0, 8)
    const flow = await call<{ id: string }>('/api/app/flows', { title, slug }), root = `/api/app/flows/${flow.id}`
    const draft = () => call<BuilderDraft>(root + '/draft')
    const add = async (step: unknown) => call(root + '/draft/steps', { expectedVersion: (await draft()).flow.draftVersion, step })
    const update = async (stepId: string, change: Record<string, unknown>) => {
      const current = await draft(), step = current.steps.find(step => step.id === stepId)!
      return call(root + '/draft', { expectedVersion: current.flow.draftVersion, stepId, prompt: step.prompt, required: step.required, ...change }, 'PUT')
    }
    const publish = async () => call(root + '/publish', { expectedVersion: (await draft()).flow.draftVersion })
    const session = async () => {
      const value = await call<{ sessionId: string; sessionToken: string; revisionId: string }>(`/api/public/flows/${slug}/sessions`, { source: 'direct', deviceClass: 'mobile' })
      await env.DB.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now() - 6000).toISOString(), value.sessionId).run()
      return value
    }
    return { flow, slug, root, draft, add, update, publish, session }
  }
  const download = async (root: string, format: 'json' | 'csv') => {
    let { token } = await call<{ token: string }>(root + '/responses/export/start?format=' + format), text = ''
    while (token) { const part = await request(root + '/responses/export', { token }); expect(part.status).toBe(200); text += await part.text(); token = part.headers.get('x-export-next') ?? '' }
    return text
  }
  return { request, call, create, download, cookie: () => cookie }
}
