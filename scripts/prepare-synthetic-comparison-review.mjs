#!/usr/bin/env node
import { devKeyHeaders } from './local-dev-key.mjs'
import assert from 'node:assert/strict'
import { request } from '@playwright/test'

// Local synthetic data only. Never overwrite or reopen an existing review.
const target = new URL(process.argv[2] ?? 'http://127.0.0.1:15620')
assert.equal(target.protocol, 'http:')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))
assert.ok(Number(target.port) >= 15620 && Number(target.port) <= 15659)
const slug = 'pencil-revision-review-20261002'
const title = 'Pencil synthetic revision review'
const context = await request.newContext({ baseURL: target.origin })
const headers = { ...devKeyHeaders(), Origin: target.origin, 'CF-Connecting-IP': '198.18.159.47' }
async function ok(path, data, method = data === undefined ? 'GET' : 'POST') {
  const response = await context.fetch(path, { method, headers, ...(data === undefined ? {} : { data }) })
  assert.ok(response.status() >= 200 && response.status() < 300, `${method} ${path}: status ${response.status()}`)
  return response.status() === 204 ? undefined : response.json()
}
const waitForFill = () => new Promise(resolve => setTimeout(resolve, 3100))
try {
  const health = await ok('/health')
  assert.deepEqual([health.deployment?.sourceSha, health.deployment?.versionId], [null, null], 'Require explicit local development, never a deployed Worker')
  const existing = await context.get(`/api/public/flows/${slug}`, { headers })
  assert.equal(existing.status(), 404, 'Existing review detected: stop before changing it')
  assert.equal((await context.get('/auth/dev/enter?as=owner', { headers, maxRedirects: 0 })).status(), 303)
  const flow = await ok('/api/app/flows', { title, slug })
  const root = `/api/app/flows/${flow.id}`
  const draft = () => ok(`${root}/draft`)
  const add = async step => { const current = await draft(); await ok(`${root}/draft/steps`, { expectedVersion: current.flow.draftVersion, step }) }
  await add({ kind: 'welcome', questionType: null, prompt: 'A synthetic visit review', helperText: 'Every response in this review is synthetic.' })
  await add({ kind: 'question', questionType: 'single_choice', prompt: 'What should we focus on?', required: true, choices: [{ value: 'experience', label: 'Tell us about the service' }, { value: 'quick', label: 'Finish now' }] })
  await add({ kind: 'question', questionType: 'long_text', prompt: 'What would make a better visit?', required: false })
  await add({ kind: 'completion', questionType: null, prompt: 'Your feedback is recorded', helperText: 'Thank you for reviewing Pencil.' })
  let current = await draft()
  const route = current.steps.find(step => step.questionType === 'single_choice')
  const detail = current.steps.find(step => step.questionType === 'long_text')
  const completion = current.steps.find(step => step.kind === 'completion')
  const experience = current.choices.find(choice => choice.value === 'experience')
  const quick = current.choices.find(choice => choice.value === 'quick')
  assert.ok(route && detail && completion && experience && quick)
  await ok(`${root}/draft/branches`, { expectedVersion: current.flow.draftVersion, rules: [{ sourceStepId: route.id, predicateKind: 'equals', expectedValue: quick.id, destinationStepId: completion.id, position: 0 }] }, 'PUT')
  current = await draft(); await ok(`${root}/publish`, { expectedVersion: current.flow.draftVersion })
  const start = source => ok(`/api/public/flows/${slug}/sessions`, { deviceClass: source === 'embed' ? 'mobile' : 'desktop', source })
  const advance = (session, stepId) => ok(`/api/public/flows/${slug}/sessions/advance`, { sessionId: session.sessionId, sessionToken: session.sessionToken, stepId })
  const submit = async (session, answers, key, disposition) => {
    const input = { sessionId: session.sessionId, sessionToken: session.sessionToken, idempotencyKey: key, answers }
    const receipt = await ok(`/api/public/flows/${slug}/responses`, input)
    assert.equal(receipt.idempotent, false); assert.equal(receipt.disposition, disposition)
    assert.equal(receipt.completionStepId, completion.id)
    assert.deepEqual(await ok(`/api/public/flows/${slug}/responses`, input), { ...receipt, idempotent: true })
    return receipt
  }
  const older = await start('direct'); await advance(older, route.id); await advance(older, detail.id); await waitForFill()
  await submit(older, [{ stepId: route.id, value: experience.id }, { stepId: detail.id, value: 'Synthetic first publication: make pickup clearer.' }], 'synthetic-review-original-revision-key', 'released')
  current = await draft()
  await ok(`${root}/draft`, { stepId: route.id, prompt: route.prompt, required: true, expectedVersion: current.flow.draftVersion, choices: current.choices.filter(choice => choice.stepId === route.id).map(choice => ({ id: choice.id, value: choice.value, label: choice.id === experience.id ? 'Tell us about the experience' : choice.label })) }, 'PUT')
  await add({ kind: 'question', questionType: 'rating', prompt: 'How was your visit?', helperText: 'This optional question was added in publication 2.', required: false, questionSettings: { min: 1, max: 5 } })
  current = await draft(); const rating = current.steps.find(step => step.questionType === 'rating')
  assert.ok(rating)
  await ok(`${root}/publish`, { expectedVersion: current.flow.draftVersion })
  const [answered, omitted] = await Promise.all([start('direct'), start('embed')])
  for (const session of [answered, omitted]) { await advance(session, route.id); await advance(session, detail.id); await advance(session, rating.id) }
  await waitForFill()
  await submit(answered, [{ stepId: route.id, value: experience.id }, { stepId: detail.id, value: 'Synthetic publication 2: clearer pickup signs helped.' }, { stepId: rating.id, value: 4 }], 'synthetic-review-rating-answer-key', 'released')
  await submit(omitted, [{ stepId: route.id, value: experience.id }, { stepId: detail.id, value: 'Synthetic embedded response: keep the clear signs.' }], 'synthetic-review-optional-omission-key', 'released')
  const quarantined = await start('embed')
  await advance(quarantined, route.id)
  await submit(quarantined, [{ stepId: route.id, value: quick.id }], 'synthetic-review-fast-quarantine-key', 'quarantined')
  const comparison = await ok(`${root}/questions/compare`)
  assert.equal(comparison.revisions.length, 2)
  assert.equal(comparison.questions.find(question => question.id === route.id).answered, 3)
  const ratingGroup = comparison.questions.find(question => question.id === rating.id)
  assert.equal(ratingGroup.answered, 1); assert.equal(ratingGroup.eligibleResponses, 2)
  assert.equal(ratingGroup.versions.length, 1)
  const results = await ok(`${root}/results`)
  assert.equal(results.starts, 3); assert.equal(results.completedResponses, 2)
  const quarantine = await ok(`/api/app/revisions/${answered.revisionId}/quarantine`)
  assert.equal(quarantine.length, 1)
  console.log(JSON.stringify({ syntheticOnly: true, preparedAt: new Date().toISOString(), flowId: flow.id, slug, title, urls: { respondent: `${target.origin}/f/${slug}`, embedded: `${target.origin}/embed/${slug}`, builder: `${target.origin}/app/flows/${flow.id}/builder`, results: `${target.origin}/app/flows/${flow.id}/results` }, revisions: comparison.revisions.map(revision => ({ id: revision.id, number: revision.number })), currentStarts: results.starts, currentReleased: results.completedResponses, quarantined: quarantine.length, rating: { answered: ratingGroup.answered, eligibleResponses: ratingGroup.eligibleResponses } }, null, 2))
} finally { await context.dispose() }
