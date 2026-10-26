#!/usr/bin/env node
// INTEG-006 local proof: one live Slack post through Pencil's own form-level chat door into the one authorized private
// channel. Never registered in CI: it needs a running `rer dev` (not `rer demo`, whose fetch guard answers slack.com
// itself) and SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET and SLACK_CHANNEL_ID injected by name. The connection's apiOrigin is
// a loopback relay (the local-development override connections.ts allows) that passes chat.postMessage for that channel
// only, unchanged, to https://slack.com/api, returns Slack's answer unchanged, counts it and keeps the message ts in
// memory; anything else is refused. The post is deleted at the end. The receipt keeps the last four characters of ids.
import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'

const { values: args } = parseArgs({ options: { origin: { type: 'string' }, 'dev-log': { type: 'string' }, out: { type: 'string' } } })
const fail = message => { console.error(`chat-slack-live: ${message}`); process.exit(1) }
const botToken = process.env.SLACK_BOT_TOKEN ?? '', signingSecret = process.env.SLACK_SIGNING_SECRET ?? '', channel = process.env.SLACK_CHANNEL_ID ?? ''
if (!botToken || !signingSecret || !/^[CG][A-Z0-9]{6,}$/.test(channel)) fail('inject SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET and SLACK_CHANNEL_ID')
if (!args.origin || !args['dev-log'] || !args.out) fail('use --origin URL --dev-log FILE --out FILE')
const origin = new URL(args.origin).origin
const last4 = value => typeof value === 'string' && value ? '…' + value.slice(-4) : null
const redact = text => [botToken, signingSecret, channel].reduce((out, secret) => out.split(secret).join('[redacted]'), String(text))
const receipt = { origin, relay: 'loopback relay to https://slack.com/api (chat.postMessage to the authorized channel only)', channel: last4(channel), steps: [] }
const step = (name, detail = {}) => { receipt.steps.push({ name, ...detail }); console.log(`${name}: ${redact(JSON.stringify(detail))}`) }
const slackCalls = []
async function slack(method, params) {
  const response = await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers: { authorization: `Bearer ${botToken}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() })
  const body = await response.json().catch(() => ({}))
  slackCalls.push({ method, ok: body.ok === true, error: body.error ?? null })
  return { body, scopes: response.headers.get('x-oauth-scopes') }
}

// Network edge.
const posts = []
const relay = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = Buffer.concat(chunks), entry = { at: new Date().toISOString(), path: request.url }
  posts.push(entry)
  let payload = {}
  try { payload = JSON.parse(body.toString()) } catch {}
  if (request.method !== 'POST' || request.url !== '/chat.postMessage' || payload.channel !== channel || request.headers.authorization !== `Bearer ${botToken}`) {
    entry.refused = true
    response.writeHead(403, { 'content-type': 'application/json' }).end('{"ok":false,"error":"relay_refused"}')
    return
  }
  entry.idempotencyKey = request.headers['idempotency-key'] ?? null
  entry.text = String(payload.text ?? '').replace(/https?:\/\/\S+/g, '<link>')
  try {
    const upstream = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(9_000), headers: { authorization: request.headers.authorization, 'content-type': 'application/json; charset=utf-8' }, body })
    const text = await upstream.text()
    entry.http = upstream.status; entry.scopes = upstream.headers.get('x-oauth-scopes')
    try { const json = JSON.parse(text); entry.ok = json.ok === true; entry.ts = json.ts ?? null; entry.error = json.error ?? null } catch { entry.ok = false }
    response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' }).end(text)
  } catch (error) { entry.http = 'transport-error'; entry.error = error?.name ?? 'Error'; response.destroy() }
})
await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve))
const relayOrigin = `http://127.0.0.1:${relay.address().port}`

// Pencil's doors, signed in through the dev log's one-click key (read here, never printed).
const jar = new Map()
const absorb = response => { for (const line of response.headers.getSetCookie()) { const pair = line.split(';')[0], at = pair.indexOf('='); const name = pair.slice(0, at).trim(), value = pair.slice(at + 1); if (!value || /max-age=0/i.test(line)) jar.delete(name); else jar.set(name, value) } }
async function call(path, { method = 'GET', body, expect, auth = true } = {}) {
  const response = await fetch(origin + path, { method, redirect: 'manual', headers: { ...(auth ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}), origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) })
  if (auth) absorb(response)
  const text = await response.text()
  let json = null; try { json = text ? JSON.parse(text) : null } catch {}
  if (expect !== undefined && response.status !== expect) fail(`${method} ${path} answered ${response.status}: ${redact(text).slice(0, 300)}`)
  return { status: response.status, json, text }
}
const devLog = () => readFileSync(args['dev-log'], 'utf8')
const open = [...devLog().matchAll(/RER_OPEN (\S+)/g)].pop()?.[1]
const devKey = open ? new URLSearchParams(new URL(open).hash.slice(1)).get('rer-dev') : null
if (!devKey) fail('the dev log has no RER_OPEN line with a key yet')
const enter = await fetch(origin + '/auth/dev/enter?as=owner&returnTo=%2Fapp', { redirect: 'manual', headers: { 'x-rer-dev-key': devKey } })
absorb(enter)
if (enter.status !== 303) fail(`dev sign-in answered ${enter.status}`)

// 1. The owner saves the Slack connection; status never echoes a credential.
const saved = await call('/api/app/connections/slack', { method: 'PUT', body: { botToken, signingSecret, apiOrigin: relayOrigin }, expect: 200 })
const status = await call('/api/app/connections/slack', { expect: 200 })
const echoes = [saved.text, status.text].some(text => text.includes(botToken) || text.includes(signingSecret))
step('connection-saved', { saved: status.json.saved, echoesCredential: echoes })
if (echoes || status.json.saved !== true) fail('the Slack connection echoed a credential or did not save')

// 2. A published form with one closed-choice field and one free-text field.
const slug = `synthetic-pencil-c46-chat-${Date.now().toString(36)}`
const { id: flowId } = (await call('/api/app/flows', { method: 'POST', body: { title: 'synthetic-pencil-c46-chat', slug }, expect: 201 })).json
const base = `/api/app/flows/${flowId}`, read = async () => (await call(`${base}/draft`, { expect: 200 })).json
for (const body of [
  { kind: 'question', questionType: 'single_choice', prompt: 'synthetic-pencil-c46 preferred window', required: true, choices: [{ value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }] },
  { kind: 'question', questionType: 'long_text', prompt: 'synthetic-pencil-c46 private note', required: false },
  { kind: 'completion', questionType: null, prompt: 'Thank you' },
]) await call(`${base}/draft/steps`, { method: 'POST', body: { expectedVersion: (await read()).flow.draftVersion, step: body }, expect: 201 })
const [choice, note] = (await read()).steps
await call(`${base}/publish`, { method: 'POST', body: { expectedVersion: (await read()).flow.draftVersion }, expect: 201 })
const operators = (await call('/api/app/operators', { expect: 200 })).json
const ownerId = (Array.isArray(operators) ? operators : operators.operators ?? []).find(operator => operator.isSetupOperator)?.id
if (!ownerId) fail('no owner operator listed')

// 3. A free-text summary field is refused at save; the closed-choice link is saved.
const link = { platform: 'slack', postResponses: true, channel, operatorId: ownerId, slackUserId: 'synthetic-pencil-c46-owner' }
const refused = await call(`${base}/chat`, { method: 'PUT', body: { ...link, answerStepIds: [note.id] } })
step('sensitive-field-refused', { status: refused.status, message: refused.json?.message ?? null, relayRequests: posts.length })
if (refused.status !== 400 || posts.length) fail('a free-text summary field was not refused at save')
const linked = await call(`${base}/chat`, { method: 'PUT', body: { ...link, answerStepIds: [choice.id] }, expect: 200 })
step('link-saved', { links: linked.json.links.map(entry => ({ platform: entry.platform, armed: entry.armed, answerStepIds: entry.answerStepIds.length })) })

// 4. One response through the public form doors, after the form's minimum fill time.
const session = (await call(`/api/public/flows/${slug}/sessions`, { method: 'POST', auth: false, body: { deviceClass: 'desktop', source: 'direct' }, expect: 201 })).json
const option = session.flow.choices.find(entry => entry.stepId === choice.id && entry.label === 'Afternoon')
await sleep(8000)
const submitted = await call(`/api/public/flows/${slug}/responses`, { method: 'POST', auth: false, expect: 201, body: { sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: session.loadTime, idempotencyKey: `synthetic-pencil-c46-chat-${session.sessionId}`, answers: [{ stepId: choice.id, value: option.id }] } })
step('response-submitted', { responseId: submitted.json.responseId })

// 5. The scheduled chat queue posts once; the relay keeps Slack's ts.
const ticks = () => (devLog().match(/RER_SCHEDULED /g) ?? []).length
for (let waited = 0; !posts.some(post => post.ok !== undefined); waited += 5) { if (waited > 180) fail('no Slack post within 180 s'); await sleep(5000) }
const tickAfterPost = ticks()
for (let waited = 0; ticks() < tickAfterPost + 1; waited += 5) { if (waited > 150) fail('no later scheduled run within 150 s'); await sleep(5000) }
await sleep(3000)
const post = posts.find(entry => entry.ok !== undefined)
const ledger = (await call('/api/app/integration-deliveries', { expect: 200 })).json.deliveries.filter(entry => entry.kind === 'slack' && entry.responseId === submitted.json.responseId)
step('posted', { relayRequests: posts.length, refusedByRelay: posts.filter(entry => entry.refused).length, http: post.http, ok: post.ok, error: post.error, ts: last4(post.ts), postedText: post.text,
  ledger: ledger.map(entry => ({ kind: entry.kind, subject: entry.subject, state: entry.state, idempotencyKey: entry.idempotencyKey })), scheduledRunsAfterPost: ticks() - tickAfterPost,
  botScopes: post.scopes ? post.scopes.split(',').filter(scope => /history|chat:write|channels|groups/.test(scope)) : null })
if (!post.ok || !post.ts) fail('Slack did not confirm the post')

// 6. Slack read, then delete the post and read back that it is gone.
const history = async () => slack('conversations.history', { channel, latest: post.ts, oldest: post.ts, inclusive: 'true', limit: '1' })
const before = await history()
step('slack-read', { method: 'conversations.history', ok: before.body.ok === true, error: before.body.error ?? null, needed: before.body.needed ?? null, found: (before.body.messages ?? []).some(message => message.ts === post.ts) })
const removed = await slack('chat.delete', { channel, ts: post.ts })
const after = before.body.ok === true ? await history() : await slack('chat.delete', { channel, ts: post.ts })
step('slack-deleted', { deleted: removed.body.ok === true, error: removed.body.error ?? null, readBack: before.body.ok === true ? { method: 'conversations.history', found: (after.body.messages ?? []).some(message => message.ts === post.ts) } : { method: 'chat.delete (second call)', error: after.body.error ?? null } })

// 7. The owner removes the connection.
const removal = await call('/api/app/connections/slack', { method: 'DELETE', expect: 200 })
step('connection-removed', { saved: removal.json.saved })
receipt.slackCalls = slackCalls
receipt.relay = posts.map(entry => ({ at: entry.at, path: entry.path, refused: Boolean(entry.refused), http: entry.http ?? null, ok: entry.ok ?? null, ts: last4(entry.ts) }))
writeFileSync(args.out, redact(JSON.stringify(receipt, null, 2)) + '\n')
relay.close()
console.log(`receipt written; relay requests ${posts.length}`)
