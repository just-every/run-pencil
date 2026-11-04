import { templatePreview, flowTemplates } from '../../src/core/features/flows/templates'
import type { PublicFlow } from '../../src/core/app/api'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { checkConfirmation, checkMail } from '../../src/base/operator-auth/conformance/presentation.mjs'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../helpers/mail-worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { initializePencil } from '../../src/core/app/worker'
import { developmentInbox } from '../helpers/development-outbox'
import type { WorkerBindings } from '../../src/core/app/environment'
// Compare independent identities by their graph positions, including choice operands.
function graphShape(graph: Pick<PublicFlow, 'steps' | 'choices' | 'branchRules'>) {
  const stepPosition = (id: string | null) => id === null ? null : graph.steps.find(step => step.id === id)!.position
  return {
    steps: graph.steps.map(({ id, nextStepId, ...step }) => ({ ...step, next: stepPosition(nextStepId) })),
    choices: graph.choices.map(({ id, stepId, ...choice }) => ({ ...choice, step: stepPosition(stepId) })),
    rules: graph.branchRules.map(({ id, sourceStepId, destinationStepId, expectedValue, ...rule }) => ({
      ...rule, source: stepPosition(sourceStepId), destination: stepPosition(destinationStepId),
      expected: rule.predicateKind === 'equals' ? graph.choices.find(choice => choice.id === expectedValue)!.value : expectedValue,
    })),
  }
}
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
contract(['BASE-ACCESS-001', 'BASE-SECRET-001', 'DASH-001', 'OPER-002', 'TMPL-001'], 'local first-owner setup preserves identity and requires email proof before inviting an equal operator', async () => {
  const origin = 'http://localhost'
  const bindings = { ...env, SEED_SAMPLE_DATA: 'false', SEED_ADMIN_EMAIL: 'configured-owner@example.test', SETUP_TOKEN: 'synthetic-local-setup-token-with-32-characters' } as WorkerBindings
  const services = await initializePencil(createPencilPlatform(origin, bindings))
  let requestNumber = 0
  const request = (path: string, body?: unknown, cookie?: string, method = body ? 'POST' : 'GET') => worker.fetch(new Request(origin + path, { method, headers: { Host: 'localhost', Origin: origin, 'CF-Connecting-IP': `198.19.${Math.floor(++requestNumber / 250)}.${requestNumber % 250}`, ...devKeyHeaders, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), bindings, {} as ExecutionContext)
  expect(await services.auth.needsBootstrap()).toBe(true)
  expect((await request('/auth/bootstrap', { token: 'incorrect', displayName: 'Owner' })).status).toBe(403)
  expect(await services.auth.needsBootstrap()).toBe(true)
  const result = await request('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Owner' })
  expect(result.status).toBe(303)
  expect(await services.auth.needsBootstrap()).toBe(false)
  expect(await env.DB.prepare('SELECT email,display_name,is_setup_operator FROM operators').first()).toEqual({ email: bindings.SEED_ADMIN_EMAIL, display_name: 'Owner', is_setup_operator: 1 })
  expect(await env.DB.prepare('SELECT count(*) n FROM flows').first()).toEqual({ n: 0 })
  expect((await request('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Replacement' })).status).toBe(409)
  const known = await request('/auth/magic-link', { email: bindings.SEED_ADMIN_EMAIL })
  const unknown = await request('/auth/magic-link', { email: 'unknown@example.test' })
  expect(await known.json()).toEqual(await unknown.json())
  const messages = (await developmentInbox(path => request(path), bindings.SEED_ADMIN_EMAIL!)).messages
  expect(messages).toHaveLength(1)
  expect((await request('/auth/local-inbox?email=configured-owner%40example.test')).status).toBe(404)
  expect(await env.DB.prepare('SELECT count(*) n FROM local_dev_inbox').first()).toEqual({ n: 0 })
  expect(await env.DB.prepare('SELECT count(*) n FROM local_mail_outbox').first()).toEqual({ n: 0 })
  const captured = await env.DB.prepare('SELECT message FROM rer_mail_development_outbox').first<{ message: string }>()
  const mail = JSON.parse(captured!.message)
  const token = messages[0].magicLinkToken
  checkMail(mail, { kind: 'magic', productName: 'Pencil', token })
  await checkConfirmation(await request('/auth/confirm?token=' + token), { kind: 'magic', productName: 'Pencil', token, theme: '/rer-theme.css' })
  await checkConfirmation(await request('/auth/confirm?token=expired'), { productName: 'Pencil', theme: '/rer-theme.css' })
  const bootstrapCookie = result.headers.get('set-cookie')!.split(';')[0]
  expect((await request('/setup', { name: 'Owner workspace', timeZone: 'Australia/Brisbane' }, bootstrapCookie)).status).toBe(303)
  const invitationInput = { email: 'invited-owner@example.test', displayName: 'Invited owner' }
  const invitationState = async () => (await env.DB.batch(['oa_operators', 'operators', 'oa_tokens', 'rer_mail_development_outbox'].map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`)))).map(result => result.results)
  const beforeInvitation = await invitationState()
  const denied = await request('/api/app/operators', invitationInput, bootstrapCookie)
  expect(denied.status).toBe(403)
  expect(await denied.json()).toEqual({ error: 'step_up_required' })
  expect(await invitationState()).toEqual(beforeInvitation)
  // The same public email-link flow offered on /signin provides fresh proof.
  // Merely previewing the link above did not authorize the bootstrap session.
  const confirmed = await request('/auth/confirm', { token })
  expect(confirmed.status).toBe(303)
  const cookie = confirmed.headers.get('set-cookie')!.split(';')[0]
  expect((await request('/auth/confirm', { token })).status).toBe(400)
  expect((await request('/api/app/operators', invitationInput, bootstrapCookie)).status).toBe(403)
  const invitation = await request('/api/app/operators', { email: 'invited-owner@example.test', displayName: 'Invited owner' }, cookie)
  expect(invitation.status).toBe(201)
  const invite = (await developmentInbox(path => request(path), 'invited-owner@example.test')).messages[0]
  const invitedMail = JSON.parse((await env.DB.prepare('SELECT message FROM rer_mail_development_outbox WHERE id=?').bind(invite.id).first<{ message: string }>())!.message)
  checkMail(invitedMail, { kind: 'invite', productName: 'Pencil', token: invite.magicLinkToken })
  await checkConfirmation(await request('/auth/confirm?token=' + invite.magicLinkToken), { kind: 'invite', productName: 'Pencil', token: invite.magicLinkToken, theme: '/rer-theme.css' })
  const joined = await request('/auth/confirm', { token: invite.magicLinkToken })
  expect(joined.status).toBe(303)
  const joinedCookie = joined.headers.get('set-cookie')!.split(';')[0]
  const joinedSession = await request('/auth/session', undefined, joinedCookie)
  expect(joinedSession.status).toBe(200)
  expect(await joinedSession.json()).toMatchObject({ operator: { email: invitationInput.email, role: 'owner', status: 'active' } })
  const operators = await request('/api/app/operators', undefined, joinedCookie)
  expect(operators.status).toBe(200)
  expect(await operators.json()).toEqual(expect.arrayContaining([
    expect.objectContaining({ email: bindings.SEED_ADMIN_EMAIL, isSetupOperator: true }),
    expect.objectContaining({ email: invitationInput.email, isSetupOperator: false }),
  ]))
  expect((await request('/auth/confirm', { token: invite.magicLinkToken })).status).toBe(400)
  expect(new Set(flowTemplates.map(item => item.id)).size).toBeGreaterThanOrEqual(60)
  const previewState = async () => (await env.DB.batch(['flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'respondent_sessions', 'respondent_session_step_events', 'responses', 'response_answers', 'revision_metric_counters', 'revision_step_metric_counters', 'response_outbox', 'audit_entries', 'rer_mail_development_outbox'].map(table => env.DB.prepare(`SELECT * FROM ${table}`)))).map(result => result.results)
  const beforePreviews = await previewState()
  expect((await request('/api/app/flows', { title: 'Unknown template', slug: 'synthetic-pencil-unknown', template: 'synthetic-pencil-unknown' }, cookie)).status).toBe(400)
  expect(await previewState()).toEqual(beforePreviews)
  const previews = flowTemplates.map(template => templatePreview(template.id))
  expect(await previewState()).toEqual(beforePreviews)
  let editable: { id: string; slug: string; definition: PublicFlow } | undefined
  for (const [index, template] of flowTemplates.entries()) {
    const created = await request('/api/app/flows', { title: template.title, slug: `synthetic-pencil-${template.id}`, template: template.id }, cookie)
    expect(created.status).toBe(201)
    const flow = await created.json() as { id: string; slug: string }
    const draft = await request(`/api/app/flows/${flow.id}/draft`, undefined, cookie)
    expect(draft.status).toBe(200)
    expect(graphShape(await draft.json() as PublicFlow), template.id).toEqual(graphShape(previews[index]))
    const published = await request(`/api/app/flows/${flow.id}/publish`, { expectedVersion: 0 }, cookie)
    expect(published.status, template.id).toBe(201)
    const publicFlow = await request(`/api/public/flows/${flow.slug}`)
    expect(publicFlow.status).toBe(200)
    const definition = await publicFlow.json() as any
    expect(graphShape(definition), template.id).toEqual(graphShape(previews[index]))
    if (template.id === 'customer-3') editable = { ...flow, definition }
    for (const path of definition.branchRules.length ? [0, 1] : [0]) {
      const started = await request(`/api/public/flows/${flow.slug}/sessions`, { deviceClass: 'desktop' })
      expect(started.status).toBe(201)
      const session = await started.json() as any
      const answers: { stepId: string; value: unknown }[] = []
      let step = definition.steps[0]
      while (step.kind !== 'completion') {
        const options = definition.choices.filter((choice: any) => choice.stepId === step.id)
        const value = options.length ? options[path]?.id ?? options[0].id : ['rating','nps','csat','ces'].includes(step.questionType) ? (path === 0 ? 5 : 1) : step.questionType === 'email' ? 'synthetic-pencil-1@example.test' : 'Synthetic business response'
        answers.push({ stepId: step.id, value })
        expect((await request(`/api/public/flows/${flow.slug}/sessions/advance`, { sessionId: session.sessionId, sessionToken: session.sessionToken, stepId: step.id })).status).toBe(204)
        const rule = definition.branchRules.find((rule: any) => rule.sourceStepId === step.id && (rule.predicateKind === 'equals' ? rule.expectedValue === value : Number(value) > rule.expectedValue))
        step = definition.steps.find((candidate: any) => candidate.id === (rule?.destinationStepId ?? step.nextStepId))
        expect(step).toBeDefined()
      }
      const completed = await request(`/api/public/flows/${flow.slug}/responses`, { sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: session.loadTime, idempotencyKey: `synthetic-pencil-${template.id}-${path}`, answers })
      expect(completed.status, template.id).toBe(201)
    }
  }
  // A gallery draft stays ordinary and editable, while its preview and live revision stay isolated.
  expect(editable).toBeDefined()
  const selected = editable!
  const base = `/api/app/flows/${selected.id}`
  const draft = await (await request(`${base}/draft`, undefined, cookie)).json() as any
  const question = draft.steps[0]
  const prompt = 'How did your synthetic delivery go?'
  const saved = await request(`${base}/draft`, { expectedVersion: draft.flow.draftVersion, stepId: question.id, prompt, required: question.required }, cookie, 'PUT')
  expect(saved.status).toBe(200)
  const changed = await (await request(`${base}/draft`, undefined, cookie)).json() as any
  expect(changed.steps[0].prompt).toBe(prompt)
  const freshPreview = templatePreview('customer-3')
  expect(graphShape(freshPreview)).toEqual(graphShape(selected.definition))
  expect((await (await request(`/api/public/flows/${selected.slug}`)).json() as PublicFlow).steps[0].prompt).toBe(selected.definition.steps[0].prompt)
  expect((await request(`${base}/publish`, { expectedVersion: changed.flow.draftVersion }, cookie)).status).toBe(201)
  expect((await (await request(`/api/public/flows/${selected.slug}`)).json() as PublicFlow).steps[0].prompt).toBe(prompt)

})
