// Synthetic emitted-runtime proof. Use a private restored state, never the owner state.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { chromium } from '@playwright/test'
import { unstable_dev } from 'wrangler'
import { importData } from './deployment-data.mjs'

// No caller-supplied HTTP runtime or mutable database is accepted. The command
// exclusively creates its own restore and owns/stops the runtime bound to it.
const origin = new URL('http://127.0.0.1:15622')
assert.ok(process.argv[2], 'Pass a private synthetic recovery archive.')
assert.match(process.argv[3] ?? '', /^[a-f0-9]{64}\.sqlite$/, 'Pass the existing binding storage filename, without a path.')
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pencil-retention-proof-'))
const state = path.join(temporary, 'state')
const directory = path.join(state, 'v3/d1/miniflare-D1DatabaseObject')
await fs.mkdir(directory, { recursive: true })
const filename = path.join(directory, process.argv[3])
importData(process.argv[2], filename)
const db = new DatabaseSync(filename)
let cookie = ''
async function call(route, data, method = data === undefined ? 'GET' : 'POST') {
  const response = await fetch(new URL(route, origin), { method, redirect: 'manual', headers: { Cookie: cookie, Origin: origin.origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.254.202' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  assert.ok(response.status < 400, `${method} ${route} returned ${response.status}`)
  return response
}
async function json(route, data, method) { return (await call(route, data, method)).json() }
let browser
let runtime
try {
  assert.ok(db.prepare('SELECT id FROM local_fixture_initializations LIMIT 1').get(), 'Use the preserved synthetic review archive.')
  process.env.WRANGLER_SEND_METRICS = 'false'
  runtime = await unstable_dev('dist/server/index.js', { config: 'dist/server/wrangler.json', local: true, bundle: true, persistTo: state, ip: origin.hostname, port: Number(origin.port), inspectorPort: 15657, logLevel: 'error', vars: { APP_ORIGIN: origin.origin, PENCIL_BUILD_ID: 'local-development', MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'true', SEED_SAMPLE_DATA: 'false' }, experimental: { testScheduled: true, watch: false, disableDevRegistry: true, disableExperimentalWarning: true, showInteractiveDevSession: false } })
  assert.equal(runtime.port, Number(origin.port))
  const health = await json('/health')
  assert.equal(health.product, 'pencil'); assert.equal(health.buildId, 'local-development')
  const email = 'owner@aurora-coffee.test'
  assert.equal((await json('/auth/magic-link', { email })).delivery, 'local')
  const inbox = await json(`/auth/local-inbox?email=${encodeURIComponent(email)}`)
  const login = await call('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
  cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  assert.ok(cookie)
  const dashboard = await json('/api/app/dashboard')
  const template = dashboard.find(flow => flow.title.startsWith('Pencil local review'))
  assert.ok(template, 'Restore the curated synthetic review first.')
  const slug = `pencil-retention-review-${Date.now()}`
  const flow = await json(`/api/app/flows/${template.id}/duplicate`, { title: 'Pencil synthetic retention review', slug })
  const base = `/api/app/flows/${flow.id}`
  const draft = await json(`${base}/draft`)
  await json(`${base}/publish`, { expectedVersion: draft.flow.draftVersion })
  const form = await json(`/api/public/flows/${slug}`)
  const route = form.steps.find(step => step.questionType === 'single_choice')
  const detail = form.steps.find(step => step.questionType === 'long_text')
  assert.ok(route); assert.ok(detail)
  const expired = await json(`/api/public/flows/${slug}/sessions`, { deviceClass: 'mobile', source: 'direct' })
  await call(`/api/public/flows/${slug}/sessions/advance`, { ...expired, stepId: route.id })
  await call(`/api/public/flows/${slug}/sessions/advance`, { ...expired, stepId: detail.id })
  const active = await json(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
  db.prepare('UPDATE respondent_sessions SET expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', expired.sessionId)
  const preserved = ['responses', 'response_answers', 'response_outbox', 'flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'audit_entries', 'local_fixture_initializations']
  const snapshot = () => preserved.map(table => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all())
  const before = snapshot()
  for (let run = 0; run < 2; run++) await call('/__scheduled?cron=15%20*%20*%20*%20*')
  assert.deepEqual(snapshot(), before)
  assert.equal(db.prepare('SELECT id FROM respondent_sessions WHERE id = ?').get(expired.sessionId), undefined)
  assert.equal(db.prepare('SELECT id FROM respondent_session_step_events WHERE session_id = ?').get(expired.sessionId), undefined)
  assert.ok(db.prepare('SELECT id FROM respondent_sessions WHERE id = ?').get(active.sessionId))
  assert.equal(db.prepare('SELECT dropped FROM revision_step_metric_counters WHERE revision_id = ? AND step_stable_id = ?').get(active.revisionId, detail.id).dropped, 1)
  assert.equal(db.prepare('SELECT starts FROM revision_metric_counters WHERE revision_id = ?').get(active.revisionId).starts, 2)
  const refused = await fetch(new URL(`/api/public/flows/${slug}/responses`, origin), { method: 'POST', headers: { Origin: origin.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...expired, answers: [], idempotencyKey: 'retention-expired-native-review' }) })
  assert.equal(refused.status, 400)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id = ?').get(active.revisionId).n, 0)
  browser = await chromium.launch()
  await fs.mkdir('test-results/review-evidence', { recursive: true })
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport })
    const [cookieName, cookieValue] = cookie.split('=')
    await context.addCookies([{ name: cookieName, value: cookieValue, url: origin.origin }])
    const page = await context.newPage(); const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(new URL(`/app/flows/${flow.id}/results`, origin).href)
    await page.getByText('1 expired sessions ended here').waitFor()
    assert.deepEqual(errors, [])
    await page.screenshot({ path: `test-results/review-evidence/retention-${name}-results.png`, fullPage: true })
    await context.close()
  }
  console.log(JSON.stringify({ synthetic: true, emittedScheduledEvents: 2, starts: 2, expiredDropOff: 1, completedResponses: 0, protectedTablesUnchanged: preserved.length, desktopMobile: true, effectsDispatched: false }))
} finally { await browser?.close(); db.close(); await runtime?.stop() }
