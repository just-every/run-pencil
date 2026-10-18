#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { request } from '@playwright/test'

// Diagnostic only. Run against a fresh, isolated synthetic loopback store.
// This does not replace test:load or any release acceptance check.
const baseURL = process.argv[2] ?? 'http://127.0.0.1:15621'
const target = new URL(baseURL)
assert.equal(target.protocol, 'http:')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Use an owned loopback preview')
assert.ok(Number(target.port) >= 15620 && Number(target.port) <= 15659, 'Use the Pencil review ports')
const context = await request.newContext({ baseURL: target.origin })
const slug = 'aurora-coffee-post-visit'
const root = `/api/public/flows/${slug}`
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(.95 * values.length) - 1]
const call = (path, index, data) => context.fetch(path, {
  method: data === undefined ? 'GET' : 'POST',
  headers: { 'CF-Connecting-IP': `198.51.100.${index % 240 + 1}` },
  ...(data === undefined ? {} : { data }),
})
async function measure(stage, cardinality, concurrency, operation) {
  const durations = new Array(cardinality); let next = 0
  const workers = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
    while (next < cardinality) {
      const index = next++; const started = performance.now()
      await operation(index); durations[index] = performance.now() - started
    }
  }))
  const failures = workers.filter(result => result.status === 'rejected')
  if (failures.length) {
    console.error(`PENCIL_NATIVE_LOAD_STAGE ${JSON.stringify({ diagnosticOnly: true, stage, cardinality, concurrency, completed: durations.filter(Number.isFinite).length, failedWorkers: failures.length })}`)
    throw failures[0].reason
  }
  const evidence = { cardinality, concurrency, p95Milliseconds: Number(p95(durations).toFixed(2)), maxMilliseconds: Number(Math.max(...durations).toFixed(2)) }
  console.log(`PENCIL_NATIVE_LOAD_STAGE ${JSON.stringify({ diagnosticOnly: true, stage, ...evidence })}`)
  return evidence
}
async function start(index) {
  const response = await call(`${root}/sessions`, index, { deviceClass: 'desktop', source: index % 2 === 0 ? 'direct' : 'embed' })
  assert.equal(response.status(), 201, 'Session must be admitted')
  return response.json()
}
try {
  assert.equal((await call('/health', 250)).status(), 200)
  const initial = await call(root, 251); assert.equal(initial.status(), 200)
  const flow = await initial.json()
  const first = flow.steps.filter(step => step.kind === 'question').sort((a, b) => a.position - b.position)[0]
  const rating = flow.steps.find(step => step.questionType === 'rating')
  const choiceQuestion = flow.steps.find(step => step.questionType === 'single_choice')
  const choice = flow.choices.find(value => value.stepId === choiceQuestion?.id)
  assert.ok(first && rating && choiceQuestion && choice, 'Use the unedited synthetic sample graph')
  const publicScreen = await measure('publicScreen', 240, 24, async index => { const response = await call(root, index); assert.equal(response.status(), 200); await response.body() })
  const transitions = await Promise.all(Array.from({ length: 60 }, (_, index) => start(index)))
  const answerTransition = await measure('answerTransition', 60, 12, async index => { const response = await call(`${root}/sessions/advance`, index, { sessionId: transitions[index].sessionId, sessionToken: transitions[index].sessionToken, stepId: first.id }); assert.equal(response.status(), 204) })
  const finals = await Promise.all(Array.from({ length: 30 }, (_, index) => start(500 + index)))
  await new Promise(resolve => setTimeout(resolve, 3100))
  const finalSubmission = await measure('finalSubmission', 30, 10, async index => {
    const response = await call(`${root}/responses`, 500 + index, { sessionId: finals[index].sessionId, sessionToken: finals[index].sessionToken, loadTime: finals[index].loadTime, idempotencyKey: `load-submission-${index}`, answers: [{ stepId: rating.id, value: 5 }, { stepId: choiceQuestion.id, value: choice.id }] })
    assert.equal(response.status(), 201)
    const receipt = await response.json(); assert.equal(receipt.disposition, 'released'); assert.equal(receipt.idempotent, false)
  })
  const serverEntry = await readFile(new URL('../dist/server/index.js', import.meta.url))
  console.log(`PENCIL_NATIVE_LOAD_DIAGNOSTIC ${JSON.stringify({ diagnosticOnly: true, doesNotReplaceOriginalGate: true, measuredAt: new Date().toISOString(), environment: 'Emitted workerd over loopback HTTP, isolated Miniflare D1', serverEntrySha256: createHash('sha256').update(serverEntry).digest('hex'), flows: 1, sourceMix: 'direct/embed alternating', publicScreen, answerTransition, finalSubmission, withinExistingThresholds: publicScreen.p95Milliseconds <= 500 && answerTransition.p95Milliseconds <= 500 && finalSubmission.p95Milliseconds <= 1000 })}`)
} finally { await context.dispose() }
