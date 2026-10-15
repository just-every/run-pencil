import { devKeyHeaders } from './local-dev-key.mjs'
import { mkdir, writeFile } from 'node:fs/promises'

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:15620')
if (origin.origin !== origin.href.replace(/\/$/, '') || origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname) || Number(origin.port) < 15620 || Number(origin.port) > 15659) throw Error('Use the assigned Pencil loopback review origin.')
let cookie = ''
async function call(path, data, method = data === undefined ? 'GET' : 'POST') {
  const response = await fetch(new URL(path, origin), { method, redirect: 'manual', headers: { ...devKeyHeaders(), Cookie: cookie, Origin: origin.origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.254.201' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  if (response.status >= 400) throw Error(`Local review ${method} ${path} failed (${response.status}): ${await response.text()}`)
  return response
}
async function json(path, data, method) { return (await call(path, data, method)).json() }
const health = await json('/health')
if (health.product !== 'pencil' || health.deployment?.sourceSha !== null || health.deployment?.versionId !== null) throw Error('This command only creates synthetic data in explicit local Pencil development.')
const email = 'owner@aurora-coffee.test'
const login = await call('/auth/dev/enter?as=owner')
cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
if (!cookie) throw Error('Native synthetic operator sign-in did not create a session.')
const dashboard = await json('/api/app/dashboard')
const template = dashboard.find((flow) => flow.title.startsWith('Synthetic desktop review'))
if (!template) throw Error('Run the complete desktop journey once to create the reviewed adaptive form.')
const slug = `pencil-owner-review-${Date.now()}`
const flow = await json(`/api/app/flows/${template.id}/duplicate`, { title: `Pencil local review ${slug.slice(-6)}`, slug })
const base = `/api/app/flows/${flow.id}`
const draft = await json(`${base}/draft`)
await json(`${base}/publish`, { expectedVersion: draft.flow.draftVersion })
const form = await json(`/api/public/flows/${slug}`)
const route = form.steps.find((step) => step.questionType === 'single_choice')
const detail = form.steps.find((step) => step.questionType === 'long_text')
const skip = form.choices.find((choice) => choice.stepId === route.id && choice.value === 'skip')
const more = form.choices.find((choice) => choice.stepId === route.id && choice.value === 'detail')
if (!route || !detail || !skip || !more) throw Error('The review form must retain the verified answer paths.')
const sessions = await Promise.all(['desktop', 'mobile', 'tablet'].map((deviceClass, index) => json(`/api/public/flows/${slug}/sessions`, { deviceClass, source: index === 1 ? 'embed' : 'direct' })))
for (const [index, session] of sessions.entries()) {
  await call(`/api/public/flows/${slug}/sessions/advance`, { ...session, stepId: route.id })
  if (index > 0) await call(`/api/public/flows/${slug}/sessions/advance`, { ...session, stepId: detail.id })
}
await new Promise((resolve) => setTimeout(resolve, 3200))
for (const [index, session] of sessions.entries()) {
  const answers = index === 0 ? [{ stepId: route.id, value: skip.id }] : [{ stepId: route.id, value: more.id }, { stepId: detail.id, value: index === 1 ? 'Synthetic review: a clear path on mobile.' : 'Synthetic review: keep the question labels when exporting.' }]
  const receipt = await json(`/api/public/flows/${slug}/responses`, { ...session, answers, idempotencyKey: crypto.randomUUID() })
  if (receipt.disposition !== 'released') throw Error('The timed synthetic completion must be released.')
}
const fast = await json(`/api/public/flows/${slug}/sessions`, { deviceClass: 'mobile', source: 'direct' })
await call(`/api/public/flows/${slug}/sessions/advance`, { ...fast, stepId: route.id })
const quarantined = await json(`/api/public/flows/${slug}/responses`, { ...fast, answers: [{ stepId: route.id, value: skip.id }], idempotencyKey: crypto.randomUUID() })
if (quarantined.disposition !== 'quarantined') throw Error('The immediate synthetic completion must remain quarantined.')
const ledger = await json(`${base}/ledger`)
if (ledger.total !== 3) throw Error('The synthetic ledger must contain exactly three released responses.')
const summary = { synthetic: true, createdAt: new Date().toISOString(), title: flow.title, builder: new URL(`/app/flows/${flow.id}/builder`, origin).href, respondent: new URL(`/f/${slug}`, origin).href, results: new URL(`/app/flows/${flow.id}/results`, origin).href, releasedResponses: ledger.total, quarantinedResponses: 1 }
await mkdir('test-results/review-evidence', { recursive: true })
await writeFile('test-results/review-evidence/owner-review.json', JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
