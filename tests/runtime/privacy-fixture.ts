import { expect } from 'vitest'
import { actionsHttp } from './actions-fixture'
import { env } from 'cloudflare:test'

/** Native three-form fixture; the privacy journey collects, exports and erases through HTTP. */
export async function seedPrivacyForm(workspaceId: string, index: number) {
  const id = crypto.randomUUID(), revisionId = crypto.randomUUID(), now = new Date().toISOString()
  const slug = 'privacy-' + crypto.randomUUID().slice(0, 8), title = `Privacy form ${index + 1}`
  const steps = ['email', 'phone', 'long_text', null].map((questionType, position) => ({ id: crypto.randomUUID(), stableId: crypto.randomUUID(), position, questionType, kind: questionType ? 'question' : 'completion', prompt: questionType ? `Privacy ${questionType}` : 'Recorded.' }))
  await env.DB.batch([
    env.DB.prepare("INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES(?,?,?,?,'open',1,?,?,?)").bind(id, workspaceId, slug, title, now, now, now),
    env.DB.prepare("INSERT INTO flow_revisions(id,flow_id,number,state,title,published_at,is_current,form_settings_json,created_at,updated_at) VALUES(?,?,1,'published',?,?,1,?, ?,?)").bind(revisionId, id, title, now, JSON.stringify({ googleSheets: true }), now, now),
    ...steps.map(step => env.DB.prepare('INSERT INTO flow_steps(id,stable_id,revision_id,position,kind,question_type,prompt,required,next_step_stable_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(step.id, step.stableId, revisionId, step.position, step.kind, step.questionType, step.prompt, step.questionType ? 1 : 0, steps[step.position+1]?.stableId ?? null, now, now)),
  ])
  return { id, slug, steps }
}

export async function privacyGoogleFixture(receiver: string) {
  expect((await fetch(receiver + '/__control/reset', { method: 'POST', body: '{}' })).status).toBe(200)
  const f = await actionsHttp({}, 'privacy-request-' + crypto.randomUUID().slice(0, 8))
  await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.lead.operatorId).run()
  await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
  const start = await f.call('/api/app/connections/google/start', { clientId: 'synthetic-pencil-1', clientSecret: 'synthetic-pencil-2', authOrigin: receiver, tokenOrigin: receiver, apiOrigin: receiver })
  expect(start.status).toBe(200)
  const authorization = await start.json() as { authorizationUrl: string }
  const grant = await fetch(authorization.authorizationUrl, { redirect: 'manual' })
  expect(grant.status).toBe(302)
  const callback = new URL(grant.headers.get('location')!)
  expect((await f.call(callback.pathname + callback.search)).status).toBe(303)
  return f
}
