#!/usr/bin/env node
// DIST-011 local proof against Twilio test credentials. Never registered in CI: it needs a running `rer dev`
// (not `rer demo`, whose fetch guard answers api.twilio.com itself) and the test pair injected as
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN. Every step goes through Pencil's own doors. The connection's
// apiOrigin is a loopback forwarder (the local-development override connections.ts allows) that relays each
// Messages request unchanged to https://api.twilio.com, returns Twilio's answer unchanged and counts it.
// Only magic numbers from https://www.twilio.com/docs/iam/test-credentials are used. The receipt keeps the
// last four characters of provider ids and no token, header or provider body.
import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'

const { values: args } = parseArgs({ options: { origin: { type: 'string' }, 'dev-log': { type: 'string' }, out: { type: 'string' }, label: { type: 'string', default: 'a' } } })
const fail = message => { console.error(`sms-twilio-test: ${message}`); process.exit(1) }
const sid = process.env.TWILIO_ACCOUNT_SID ?? '', token = process.env.TWILIO_AUTH_TOKEN ?? ''
if (!/^AC[0-9a-f]{32}$/.test(sid) || !token) fail('inject the Twilio test pair as TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN')
if (!args.origin || !args['dev-log'] || !args.out) fail('use --origin URL --dev-log FILE --out FILE [--label a]')
const origin = new URL(args.origin).origin, label = args.label.replace(/[^a-z0-9]/g, '').slice(0, 8)
const last4 = value => typeof value === 'string' && value ? '…' + value.slice(-4) : null
const redact = text => String(text).split(token).join('[token]').split(sid).join('AC' + last4(sid))

// Twilio test-credential magic numbers (Messages section of the page above).
const VALID_FROM = '+15005550006', INVALID_FROM = '+15005550001'
const cases = [
  { id: 'S1', to: '+15005550006', anchor: '#test-sms-messages-parameters-To', documented: 'All others: number is validated normally (no error)' },
  { id: 'F1', to: '+15005550001', anchor: '#test-sms-messages-parameters-To', documented: '21211 phone number is invalid' },
  { id: 'F2', to: '+15005550002', anchor: '#test-sms-messages-parameters-To', documented: "21612 Twilio can't route to this number" },
  { id: 'F3', to: '+15005550003', anchor: '#test-sms-messages-parameters-To', documented: '21408 account lacks international permissions' },
  { id: 'F4', to: '+15005550004', anchor: '#test-sms-messages-parameters-To', documented: '21610 number is blocked for your account' },
  { id: 'F5', to: '+15005550009', anchor: '#test-sms-messages-parameters-To', documented: "21614 number can't receive SMS" },
]
const invalidFrom = { id: 'F6', to: '+15005550006', from: INVALID_FROM, anchor: '#test-sms-messages-parameters-From', documented: '21212 phone number is invalid' }

// Network edge: only POST Messages.json for the injected test account is relayed; anything else is refused and listed.
const provider = []
const forwarder = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = Buffer.concat(chunks), entry = { at: new Date().toISOString(), method: request.method }
  provider.push(entry)
  const authorization = request.headers.authorization ?? ''
  const user = authorization.startsWith('Basic ') ? Buffer.from(authorization.slice(6), 'base64').toString().split(':')[0] : ''
  const match = /^\/2010-04-01\/Accounts\/([^/]+)\/Messages\.json$/.exec(request.url ?? '')
  if (request.method !== 'POST' || !match || decodeURIComponent(match[1]) !== sid || user !== sid) {
    entry.refused = true
    response.writeHead(403, { 'content-type': 'application/json' }).end('{"forwarder":"refused"}')
    return
  }
  const form = new URLSearchParams(body.toString())
  Object.assign(entry, { to: form.get('To'), from: form.get('From'), idempotencyKey: request.headers['idempotency-key'] ?? null, statusCallback: form.get('StatusCallback') })
  try {
    const upstream = await fetch('https://api.twilio.com' + request.url, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(9_000),
      headers: { authorization, 'content-type': request.headers['content-type'] ?? 'application/x-www-form-urlencoded', ...(entry.idempotencyKey ? { 'idempotency-key': entry.idempotencyKey } : {}) }, body })
    const text = await upstream.text()
    entry.status = upstream.status
    try { const json = JSON.parse(text); entry.code = json.code ?? null; entry.messageSid = typeof json.sid === 'string' ? json.sid : null; entry.twilioStatus = json.status ?? null } catch { entry.code = null }
    response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' }).end(text)
  } catch (error) {
    entry.status = 'transport-error'; entry.error = error?.name ?? 'Error'
    response.destroy()
  }
})
await new Promise(resolve => forwarder.listen(0, '127.0.0.1', resolve))
const forwarderOrigin = `http://127.0.0.1:${forwarder.address().port}`

// Pencil's own doors, signed in through the dev log's one-click key (read here, never printed).
const jar = new Map()
const absorb = response => {
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(';')[0], at = pair.indexOf('='), name = pair.slice(0, at).trim(), value = pair.slice(at + 1)
    if (!value || /max-age=0/i.test(line)) jar.delete(name); else jar.set(name, value)
  }
}
async function call(path, { method = 'GET', body, expect } = {}) {
  const response = await fetch(origin + path, { method, redirect: 'manual', headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) })
  absorb(response)
  const text = await response.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
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

const receipt = { label, origin, forwarder: 'loopback relay to https://api.twilio.com (POST Messages.json for the test account only)', account: 'AC' + last4(sid), steps: [], cases: [] }
const step = (name, detail) => { receipt.steps.push({ name, ...detail }); console.log(`${name}: ${JSON.stringify(detail)}`) }
const providerCount = () => provider.length

// 1. Workspace ready to send: first-run setup and an open sending window (WS-002 quiet hours would defer otherwise).
const setup = await fetch(origin + '/setup', { method: 'POST', redirect: 'manual', headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), origin, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'synthetic-pencil-c46 business', timeZone: 'America/New_York' }) })
step('setup', { status: setup.status })
const hhmm = hours => new Date(Date.now() + hours * 3600_000).toISOString().slice(11, 16)
const window = { timeZone: 'UTC', sendingWindowStart: hhmm(-1), sendingWindowEnd: hhmm(5) }
await call('/api/app/workspace', { method: 'PUT', body: window, expect: 200 })
step('sending-window', { ...window, note: 'opened around the proof window on this scratch installation' })

// 2. The owner saves the Twilio test connection; status never echoes the token or the account SID.
const connection = from => ({ accountId: sid, authToken: token, fromNumber: from, a2pState: 'approved', apiOrigin: forwarderOrigin })
const saved = await call('/api/app/connections/sms', { method: 'PUT', body: connection(VALID_FROM), expect: 200 })
const read = await call('/api/app/connections/sms', { expect: 200 })
const echoes = [saved.text, read.text].some(text => text.includes(token) || text.includes(sid))
step('connection-saved', { status: { saved: read.json.saved, a2pState: read.json.a2pState, fromNumber: read.json.fromNumber }, echoesTokenOrSid: echoes })
if (echoes || read.json.saved !== true) fail('the saved SMS connection echoed a credential or did not save')

// 3. A published flow.
const slug = `synthetic-pencil-c46-sms-${label}-${Date.now().toString(36)}`
const flow = (await call('/api/app/flows', { method: 'POST', body: { title: `synthetic-pencil-c46 SMS proof ${label}`, slug, template: 'feedback' }, expect: 201 })).json
const draft = (await call(`/api/app/flows/${flow.id}/draft`, { expect: 200 })).json
await call(`/api/app/flows/${flow.id}/publish`, { method: 'POST', body: { expectedVersion: draft.flow.draftVersion }, expect: 201 })
step('flow-published', { flowId: flow.id })

// 4. Contacts: one per case with recorded consent, and one without consent.
const wording = 'I agree to receive survey invitations and reminders by SMS from synthetic-pencil-c46 business. Reply STOP to opt out.'
let n = 0
const contact = async (mobile, consent) => (await call('/api/app/distribution/contacts', { method: 'POST', expect: 201, body: { name: `synthetic-pencil-c46-${label}-${++n}`, email: `synthetic-pencil-c46-${label}-${n}@example.test`, mobile, fields: {}, ...(consent ? { smsConsent: { given: true, wording } } : {}) } })).json
const distribution = () => call(`/api/app/flows/${flow.id}/distribution`, { expect: 200 })
const launch = async (contactId, key) => call(`/api/app/flows/${flow.id}/distribution`, { method: 'POST', body: { channel: 'sms', contactIds: [contactId], commandKey: key } })
const archive = async () => {
  const body = (await call('/api/app/backup/export', { method: 'POST', body: {}, expect: 200 })).json
  const rows = name => { const table = body.payload.tables.find(t => t.name === name); return table.rows.map(row => Object.fromEntries(table.columns.map((column, i) => [column, row[i].type === 'null' ? null : row[i].value]))) }
  return { deliveries: rows('mail_deliveries'), attempts: rows('mail_delivery_attempts'), consents: rows('sms_consent_events') }
}

// 5. Unconsented contact: refused at launch, before any provider request.
const unconsented = await contact('+15005550006', false)
const before = providerCount(), refusal = await launch(unconsented.id, `synthetic-pencil-c46-${label}-unconsented`)
step('unconsented-launch', { status: refusal.status, message: refusal.json?.message ?? null, providerRequests: providerCount() - before })
if (refusal.status !== 400 || providerCount() !== before) fail('the unconsented launch was not refused before the provider')

// 6. One launch per case. The launch door runs the existing dispatcher, which sends at once inside the window.
const runCase = async (item, from = VALID_FROM) => {
  const person = await contact(item.to, true), start = providerCount()
  const key = `synthetic-pencil-c46-${label}-${item.id}`
  const launched = await launch(person.id, key)
  const sent = provider.slice(start)
  const participants = (await distribution()).json.participants.filter(p => p.email === `synthetic-pencil-c46-${label}-${n}@example.test`)
  const invitation = participants.find(p => p.kind === 'invitation')
  receipt.cases.push({ case: item.id, to: item.to, from, documented: item.documented, anchor: item.anchor, launch: launched.status,
    providerRequests: sent.length, http: sent.map(s => s.status), twilioCode: sent.map(s => s.code ?? null), messageSid: sent.map(s => last4(s.messageSid)),
    pencil: invitation ? { deliveryId: invitation.deliveryId, status: invitation.status, deliveryStatus: invitation.deliveryStatus, reason: invitation.reason, attempts: invitation.attempts } : null,
    contactId: person.id, key })
  step(`case-${item.id}`, receipt.cases.at(-1))
  return { person, key, invitation }
}
const success = await runCase(cases[0])
for (const item of cases.slice(1)) await runCase(item)

// 7. Replaying the success launch's command key starts no second provider request.
const replayStart = providerCount(), replay = await launch(success.person.id, success.key)
step('replay-launch', { status: replay.status, providerRequests: providerCount() - replayStart })

// 8. Invalid From on a second connection save.
await call('/api/app/connections/sms', { method: 'PUT', body: connection(INVALID_FROM), expect: 200 })
await runCase(invalidFrom, INVALID_FROM)
await call('/api/app/connections/sms', { method: 'PUT', body: connection(VALID_FROM), expect: 200 })

// 9. The scheduled dispatcher (rer dev runs the Worker cron each minute) runs again: no second request, no second attempt row.
const archived = await archive()
const ours = new Set(receipt.cases.map(c => c.pencil?.deliveryId).filter(Boolean))
const attemptRows = () => archived.attempts.filter(a => ours.has(a.delivery_id))
const beforeTick = { requests: providerCount(), attempts: attemptRows().length }
const ticks = () => (devLog().match(/RER_SCHEDULED /g) ?? []).length
const tickStart = ticks()
for (let waited = 0; ticks() < tickStart + 1; waited += 5) { if (waited > 150) fail('no scheduled run reached the dev log within 150 s'); await sleep(5000) }
await sleep(3000)
const after = await archive()
const afterAttempts = after.attempts.filter(a => ours.has(a.delivery_id))
step('scheduled-rerun', { scheduledRunsSeen: ticks() - tickStart, providerRequestsBefore: beforeTick.requests, providerRequestsAfter: providerCount(), attemptRowsBefore: beforeTick.attempts, attemptRowsAfter: afterAttempts.length })
for (const item of receipt.cases) {
  const delivery = after.deliveries.find(d => d.id === item.pencil?.deliveryId)
  item.archive = { status: delivery?.status ?? null, providerId: last4(delivery?.provider_id), reason: delivery?.reason ?? null,
    attempts: afterAttempts.filter(a => a.delivery_id === item.pencil?.deliveryId).map(a => ({ ordinal: a.ordinal, event: a.event, providerId: last4(a.provider_id), reason: a.reason })) }
}
const consent = after.consents.find(c => c.contact_id === success.person.id)
step('consent-record', { given: consent?.given, source: consent?.source, actorKind: consent?.actor_kind, actorRecorded: Boolean(consent?.actor_operator_id), at: consent?.created_at, wording: consent?.wording })

// 10. The owner removes the connection; status reads back unsaved.
await call('/api/app/connections/sms', { method: 'DELETE', expect: 200 })
const removed = (await call('/api/app/connections/sms', { expect: 200 })).json
step('connection-removed', { saved: removed.saved })

receipt.providerRequests = provider.map(p => ({ at: p.at, to: p.to ?? null, from: p.from ?? null, http: p.status ?? null, twilioCode: p.code ?? null, messageSid: last4(p.messageSid), refused: Boolean(p.refused), statusCallback: p.statusCallback ? new URL(p.statusCallback).pathname : null }))
receipt.otherOutbound = provider.filter(p => p.refused).length
writeFileSync(args.out, JSON.stringify(receipt, null, 2) + '\n')
forwarder.close()
console.log(`receipt written; provider requests ${provider.length}, refused ${receipt.otherOutbound}`)
