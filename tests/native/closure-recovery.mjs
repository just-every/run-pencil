// Browser-free emitted workerd proof. This runner owns fresh synthetic D1 only.
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { unstable_dev } from 'wrangler'

process.env.WRANGLER_SEND_METRICS = 'false'
const state = await mkdtemp(join(tmpdir(), 'pencil-closure-isolated-'))
console.log(`Synthetic state retained: ${state}`)
execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'pencil-local', '--local', '--persist-to', state, '--config', 'wrangler.toml'], { stdio: 'pipe' })
const origin = 'http://127.0.0.1:15683'
let runtime, db, cookie = '', serial = 0
async function request(path, body, { method = body === undefined ? 'GET' : 'POST', authenticated = true, address } = {}) {
  return fetch(`${origin}${path}`, { method, redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: authenticated ? cookie : '', 'CF-Connecting-IP': address ?? `198.18.201.${++serial}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
async function ok(path, body, options) {
  const response = await request(path, body, options)
  assert.ok(response.status >= 200 && response.status < 300, `${path}: ${response.status}`)
  return response.status === 204 ? undefined : response.json()
}
function privateAbsent(text, values) { for (const value of values) assert.ok(!text.includes(value), 'Private data appeared in a public response') }
try {
  runtime = await unstable_dev('dist/server/index.js', { config: 'dist/server/wrangler.json', local: true, bundle: true, persistTo: state, ip: '127.0.0.1', port: 15683, inspectorPort: 15684, logLevel: 'error', vars: { APP_ORIGIN: origin, MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'true', SEED_SAMPLE_DATA: 'true' }, experimental: { watch: false, disableDevRegistry: true, disableExperimentalWarning: true, showInteractiveDevSession: false } })
  await ok('/health')
  const directory = join(state, 'v3/d1/miniflare-D1DatabaseObject')
  const filename = (await readdir(directory)).find(name => name.endsWith('.sqlite'))
  assert.ok(filename)
  db = new DatabaseSync(join(directory, filename))
  await ok('/auth/magic-link', { email: 'owner@aurora-coffee.test' })
  const inbox = await ok('/auth/local-inbox?email=owner%40aurora-coffee.test')
  const login = await request('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
  assert.equal(login.status, 303); cookie = login.headers.get('set-cookie').split(';')[0]
  const slug = 'isolated-closure-recovery'
  const flow = await ok('/api/app/flows', { title: 'Synthetic closure recovery', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => ok(`${path}/draft`)
  for (const step of [{ kind: 'question', questionType: 'long_text', prompt: 'Private feedback', required: true }, { kind: 'completion', questionType: null, prompt: 'Original completion' }]) {
    const current = await draft()
    await ok(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step })
  }
  let current = await draft()
  await ok(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const session = await ok(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
  db.prepare('UPDATE respondent_sessions SET created_at = ? WHERE id = ?').run(new Date(Date.now() - 5000).toISOString(), session.sessionId)
  const payload = { sessionId: session.sessionId, sessionToken: session.sessionToken, idempotencyKey: 'isolated-original-key', answers: [{ stepId: current.steps[0].id, value: 'Synthetic confidential original answer' }] }
  const secrets = [payload.answers[0].value, session.sessionId, session.sessionToken, payload.idempotencyKey]
  await ok(`${path}/close`, {})
  for (let i = 0; i < 2; i++) {
    const denied = await request(`/api/public/flows/${slug}/responses`, payload)
    assert.equal(denied.status, 409)
    const text = await denied.text(); assert.equal(JSON.parse(text).error, 'FLOW_CLOSED'); privateAbsent(text, secrets)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id=?').get(session.revisionId).n, 0)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM response_answers WHERE response_id IN (SELECT id FROM responses WHERE revision_id=?)').get(session.revisionId).n, 0)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id IN (SELECT id FROM responses WHERE revision_id=?)').get(session.revisionId).n, 0)
  }
  for (const document of [`/f/${slug}`, `/embed/${slug}`]) {
    const response = await request(document, undefined, { authenticated: false })
    const html = await response.text(); assert.ok(html.includes('This feedback flow is closed.')); assert.ok(html.includes('Synthetic closure recovery')); privateAbsent(html, secrets)
    assert.ok(!html.includes('Retry submission')); assert.equal(response.headers.get('set-cookie'), null)
  }
  await ok(`${path}/reopen`, {})
  assert.equal((await ok(`/api/public/flows/${slug}`)).revision.id, session.revisionId)
  const receipt = await ok(`/api/public/flows/${slug}/responses`, payload)
  assert.equal(receipt.disposition, 'released'); assert.equal(receipt.idempotent, false); assert.equal(receipt.completionStepId, current.steps[1].id)
  await ok(`${path}/close`, {})
  assert.deepEqual(await ok(`/api/public/flows/${slug}/responses`, payload), { ...receipt, idempotent: true })
  assert.deepEqual(db.prepare('SELECT idempotency_key FROM responses WHERE revision_id=?').all(session.revisionId).map(row => row.idempotency_key), [payload.idempotencyKey])
  assert.deepEqual(db.prepare('SELECT value_json FROM response_answers WHERE response_id=?').all(receipt.responseId).map(row => row.value_json), [JSON.stringify(payload.answers[0].value)])
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM response_outbox WHERE response_id=?').get(receipt.responseId).n, 1)
  const exported = await ok(`${path}/responses/export`); assert.equal(exported.responses.length, 1); assert.equal(exported.responses[0].id, receipt.responseId)
  assert.equal((await ok(`${path}/results`)).completedResponses, 1)
  await ok(`${path}/reopen`, {})
  current = await draft()
  await ok(`${path}/draft`, { stepId: current.steps[0].id, prompt: 'Changed publication prompt', required: true, expectedVersion: current.flow.draftVersion }, { method: 'PUT' })
  current = await draft(); await ok(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  assert.notEqual((await ok(`/api/public/flows/${slug}`)).revision.id, session.revisionId)
  assert.deepEqual(await ok(`/api/public/flows/${slug}/responses`, { ...payload, answers: [{ stepId: current.steps[0].id, value: 'Changed payload must never replace original' }] }), { ...receipt, idempotent: true })
  const html = await (await request(`/f/${slug}`, undefined, { authenticated: false })).text()
  assert.ok(html.includes('Changed publication prompt')); privateAbsent(html, [...secrets, receipt.responseId]); assert.ok(html.includes('Before you share'))
  assert.equal((await request('/app', undefined, { authenticated: false })).status, 302)
  assert.equal((await request(`${path}/responses/export`, undefined, { authenticated: false })).status, 401)
  const limit = JSON.parse(await readFile('seed.json', 'utf8')).limits.publicRateLimits.finalSubmissionsPerIpPerMinute
  const address = '198.18.202.220', hash = createHash('sha256').update(`public-rate:${address}`).digest('hex')
  const began = Math.floor(Date.now() / 60000) * 60000
  for (const start of [began, began + 60000]) {
    const date = new Date(start).toISOString()
    db.prepare("INSERT INTO public_rate_limit_windows (id,scope,address_hash,window_started_at,count,expires_at,created_at,updated_at) VALUES (?, 'submission', ?, ?, ?, ?, ?, ?)").run(`synthetic-rate-${start}`, hash, date, limit, new Date(start + 60000).toISOString(), date, date)
  }
  const limited = await request(`/api/public/flows/${slug}/responses`, payload, { address })
  assert.equal(limited.status, 429); assert.equal((await limited.json()).error, 'RATE_LIMITED')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM responses WHERE revision_id=?').get(session.revisionId).n, 1)
  console.log('PASS: emitted closure/refusal privacy; fresh closed documents; same-revision reopening; exact original-key/answer/receipt/outbox; publication replay; public SSR; session boundaries; final rate enforcement')
} finally {
  db?.close()
  await runtime?.stop()
}
