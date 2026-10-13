import { afterEach, expect, vi } from 'vitest'
import { contract } from '../../../test/contract'
import { brandMailFixture, now, png, jpeg, webp } from './brand-mail-fixture'
import { neutralBrand, publicBrandConfig } from '../brand'
import { encodeLogo, logoByteLimit } from '../brand'
import { readNotificationBrand } from './brand.server'
// @ts-expect-error Maintained Base JavaScript facade has no declarations.
import { serializeSendGridMessage } from '../../../base/mail/index.mjs'
import { composeResponseNotification } from './compose'

const fixtures: ReturnType<typeof brandMailFixture>[] = []
const fixture = () => { const f = brandMailFixture(); fixtures.push(f); f.workspace(); return f }
afterEach(() => { vi.unstubAllGlobals(); for (const f of fixtures.splice(0)) f.sql.close() })
function transport(statuses = [202]) {
  const bodies: any[] = []
  const fetch = vi.fn(async (_url: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return new Response(null, { status: statuses[Math.min(bodies.length - 1, statuses.length - 1)] }) })
  vi.stubGlobal('fetch', fetch)
  return { bodies, fetch }
}
const input = { flowTitle: 'Feedback', submittedAt: now, timeZone: 'Australia/Brisbane', resultsUrl: 'https://forms.example.test/app/flows/business/results' }

contract(['BRAND-001','NOTIFY-002','NOTIFY-004'], 'saved identity reaches actual service mail with exact PNG, JPEG and WebP inline bytes and no remote resources', async () => {
  const f = fixture(), wire = transport()
  const name = '<script>business & "name"</script>\r\nBcc: x@example.test'
  const supportingLine = '<img src="https://remote.test/pixel"> & \'line\' עברית'
  await f.services.brand.save('business', { name, supportingLine, accent: '#ffdd00', publicFlowSlug: null })
  const form = publicBrandConfig(await f.services.brand.get('business'), { productName: 'Pencil', organizationName: '', showPoweredByCredit: false })
  for (const [mime, bytes, extension] of [['image/png', png, 'png'], ['image/jpeg', jpeg, 'jpg'], ['image/webp', webp, 'webp']] as const) {
    await f.services.brand.saveLogo('business', bytes, mime)
    f.response(extension)
    expect(await f.services.notifications.dispatcher.run(now)).toEqual({ attempted: 1, senderError: null })
    const body = wire.bodies.at(-1), text = body.content.find((c: any) => c.type === 'text/plain').value, html = body.content.find((c: any) => c.type === 'text/html').value
    expect(text).toContain(form.publicFlowBusinessName); expect(text).toContain(form.publicFlowPurpose)
    expect(html).toContain('background:#ffdd00;color:#000000'); expect(html).toContain('&lt;script&gt;business &amp; &quot;name&quot;&lt;/script&gt;')
    expect(html).toContain('&lt;img src=&quot;https://remote.test/pixel&quot;&gt; &amp; &#39;line&#39; עברית')
    expect(body.subject).not.toMatch(/[\r\n]/)
    expect(html.match(/<img\b/g)).toHaveLength(1)
    expect(body.attachments).toEqual([{ content: encodeLogo(bytes), type: mime, filename: `business-logo.${extension}`, disposition: 'inline', content_id: 'business-logo@pencil' }])
    expect(html).toContain(`src="cid:${body.attachments[0].content_id}"`)
    expect(Uint8Array.from(Buffer.from(body.attachments[0].content, 'base64'))).toEqual(bytes)
    expect(html).not.toMatch(/<script|<iframe|<link|@font|<img[^>]+src="(?:https?:|data:|\/)/i)
    expect(html).toContain(input.resultsUrl); expect(text).toContain('10:00:00'); expect(text).toContain('Australia/Brisbane')
    expect(body.from).toEqual({ email: 'no-reply@example.test' }); expect(body.headers['Auto-Submitted']).toBe('auto-generated')
    expect(body.tracking_settings).toEqual({ click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, ganalytics: { enable: false } })
  }
  expect(wire.fetch).toHaveBeenCalledTimes(3)
  expect(f.brandReads()).toBe(3)
})

contract(['BRAND-001','NOTIFY-002'], 'neutral identity matches forms; saved removal and an empty supporting line apply on the next run of the same services', async () => {
  const f = fixture(), wire = transport()
  f.response('neutral'); await f.services.notifications.dispatcher.run(now)
  expect(wire.bodies[0].subject).toBe(`${neutralBrand.name}: new response to Feedback`)
  expect(wire.bodies[0].content[1].value).toContain(`background:${neutralBrand.accent}`)
  expect(wire.bodies[0].attachments).toBeUndefined()
  expect(await f.services.brand.get('business')).toMatchObject(neutralBrand)
  await f.services.brand.save('business', { name: 'Saved business', supportingLine: '', accent: '#245c46', publicFlowSlug: null })
  await f.services.brand.saveLogo('business', png, 'image/png')
  f.response('logo'); await f.services.notifications.dispatcher.run(now)
  expect(wire.bodies[1].attachments).toHaveLength(1)
  await f.services.brand.removeLogo('business')
  f.response('removed'); await f.services.notifications.dispatcher.run(now)
  expect(wire.bodies[2].attachments).toBeUndefined()
  expect(wire.bodies[2].content[1].value).not.toContain('<img')
  expect(wire.bodies[2].content[0].value.startsWith('Saved business\nNew response')).toBe(true)
  expect(wire.bodies[2].content[1].value).not.toContain('<p dir="auto"></p>')
})

contract(['BRAND-001','NOTIFY-002'], 'one bounded snapshot per workspace per run is shared across batches and workspace brands remain isolated', async () => {
  const f = fixture(), wire = transport()
  f.workspace('second')
  for (const id of ['business','second']) await f.services.brand.save(id, { name: id, supportingLine: `Line ${id}`, accent: '#245c46', publicFlowSlug: null })
  await f.services.brand.saveLogo('business', png, 'image/png')
  for (let i = 0; i < 56; i++) f.response(`response-${i}`, i % 2 ? 'second' : 'business')
  expect(f.brandReads()).toBe(0)
  expect(await f.services.notifications.dispatcher.run(now)).toEqual({ attempted: 56, senderError: null })
  expect(f.brandReads()).toBe(2); expect(wire.bodies).toHaveLength(56)
  for (const body of wire.bodies) {
    const id = body.personalizations[0].to[0].email.split('@')[0]
    expect(body.subject).toBe(`${id}: new response to Feedback`)
    expect(body.content[0].value).toContain(`Line ${id}`)
    expect(Boolean(body.attachments)).toBe(id === 'business')
  }
  const snapshot = await readNotificationBrand(f.db, 'business')
  expect(snapshot.logo!.content.byteLength).toBeLessThanOrEqual(logoByteLimit)
  expect(Object.keys(snapshot).sort()).toEqual(['accentColor','businessName','logo','supportingLine'])
  const composed = composeResponseNotification({ ...input, ...snapshot })
  const serialized = JSON.parse(serializeSendGridMessage({ deliveryId: 'synthetic', from: 'no-reply@example.test', to: ['operator@example.test'], ...composed }))
  expect(serialized.attachments[0].content).toBe(encodeLogo(png))
})

contract(['BRAND-001','NOTIFY-002','NOTIFY-004'], 'rate-limited branded mail retains its durable key and records the next ordinal and outcome without disclosing response data', async () => {
  const f = fixture(), wire = transport([429,202])
  await f.services.brand.saveLogo('business', png, 'image/png')
  f.response('private-response-id')
  f.sql.prepare("INSERT INTO flow_steps(id,stable_id,revision_id,position,kind,question_type,prompt,required,created_at,updated_at) VALUES('question','question','business',0,'question','short_text','Private',0,?,?)").run(now, now)
  f.sql.prepare("INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at) VALUES('answer','private-response-id','question',?,?,?)").run(JSON.stringify('PRIVATE-ANSWER-respondent@example.test'), now, now)
  await f.services.notifications.dispatcher.run(now)
  const first = f.sql.prepare('SELECT * FROM notification_deliveries').get()!
  expect(first.status).toBe('pending'); expect(first.attempts).toBe(1)
  await f.services.notifications.dispatcher.run(String(first.available_at))
  const last = f.sql.prepare('SELECT * FROM notification_deliveries').get()!
  expect(last.status).toBe('sent'); expect(last.attempts).toBe(2); expect(last.idempotency_key).toBe(first.idempotency_key)
  expect(f.sql.prepare('SELECT ordinal,event FROM notification_attempts ORDER BY ordinal,rowid').all()).toEqual([{ ordinal: 1, event: 'started' }, { ordinal: 1, event: 'transient' }, { ordinal: 2, event: 'started' }, { ordinal: 2, event: 'sent' }])
  expect(wire.bodies.map(b => b.custom_args.rer_delivery_id)).toEqual([first.idempotency_key,first.idempotency_key])
  expect(wire.bodies.map(b => b.headers['X-Pencil-Notification-Attempt'])).toEqual(['1','2'])
  expect(JSON.stringify(wire.bodies)).not.toMatch(/PRIVATE-ANSWER|respondent@example|private-response-id|[?&](?:token|grant)=/)
  expect(f.brandReads()).toBe(2)
})
