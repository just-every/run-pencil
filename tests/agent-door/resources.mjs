import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, webcrypto } from 'node:crypto'
import { serveHosted, HOSTED_ORIGIN } from '@runeditrun/rer/internal/cli/hosted-output.mjs'
import { signJws, seconds, policyEnvelope, autonomousPolicy, accessToken } from '@runeditrun/rer/internal/modules/agent-door/conformance/crypto.mjs'

// Extend the hosted door check with resource scope and exact native-projection
// proof. Only this disposable installation's signing ring and sessions are used.
export async function checkPencilResources(root, declaration) {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const kid = randomUUID(), installationId = randomUUID(), issuer = `https://synthetic-pencil-${randomUUID()}.invalid`
  const email = 'synthetic-pencil-1@example.invalid', sub = randomUUID(), business = 'synthetic-pencil-1'
  const { kty, crv, x, y } = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
  const keys = { [kid]: { kty, crv, x, y, kid, alg: 'ES256', use: 'sig' } }
  const hosted = await serveHosted(root, { declaration, outboundService: () => new Response(null, { status: 503 }), bindings: {
    RER_OWNER_CLAIM_ISSUER: issuer, RER_OWNER_CLAIM_INSTALLATION_ID: installationId,
    RER_OWNER_CLAIM_APP_ORIGIN: HOSTED_ORIGIN, RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify(keys),
    RER_BUSINESS_TRUST: JSON.stringify({ v: 1, issuer, audience: HOSTED_ORIGIN, subject: installationId, email, keys }),
    MAIL_FROM: email, OWNER_EMAIL: email, SEED_ADMIN_EMAIL: email, SETUP_TOKEN: randomBytes(32).toString('hex'),
  } })
  console.log('Pencil resources: disposable hosted installation ready')
  const sign = (typ, payload) => signJws(pair.privateKey, kid, typ, payload)
  const post = (path, body, cookie) => hosted.fetch(path.replace(/^\//, ''), { method: 'POST', redirect: 'manual', headers: {
    Origin: HOSTED_ORIGIN, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}),
  }, body: JSON.stringify(body) })
  try {
    const iat = seconds()
    const claim = await sign('rer-owner-claim+jwt', { v: 1, iss: issuer, aud: HOSTED_ORIGIN, installationId, email, jti: randomUUID(), iat, exp: iat + 300 })
    const admitted = await post('/auth/owner-claim', { token: claim, displayName: 'Synthetic Pencil 1', returnTo: '/' })
    assert.equal(admitted.status, 303, 'Native owner admission must succeed')
    const cookie = admitted.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
    await admitted.body?.cancel()
    assert.ok(cookie)
    const settings = await sign('rer-business-settings+jwt', { v: 1, iss: issuer, aud: HOSTED_ORIGIN, sub: installationId, business, email, owner_id: sub, jti: randomUUID(), iat, exp: iat + 300, rev: 1, values: {}, logo: null, team: null })
    const paired = await post('/api/rer/business-settings', { settings })
    assert.equal(paired.status, 200)
    assert.equal((await paired.json()).rev, 1)
    const context = { signer: { privateKey: pair.privateKey, kid, installationId, issuer }, origin: HOSTED_ORIGIN,
      person: { sub, email }, business, consent: randomUUID(), agentId: randomUUID(), seq: 0, revision: 0,
      surface: { specialist: 'form-design', tools: [{ scope: 'pencil.flows.read' }, { scope: 'pencil.flows.write' }] }, resourceScopes: ['evidence:read'] }
    const policy = await policyEnvelope(context, autonomousPolicy())
    const adopted = await post('/api/rer/agent-policy', { policy: policy.policy })
    assert.equal(adopted.status, 200)
    await adopted.body?.cancel()
    const token = await accessToken(context)
    let id = 0
    async function mcp(method, params, bearer = token) {
      const response = await hosted.fetch('mcp', { method: 'POST', headers: {
        Origin: HOSTED_ORIGIN, Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`, 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': method,
        ...(['tools/call', 'resources/read'].includes(method) ? { 'Mcp-Name': params.name ?? params.uri } : {}),
      }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }) })
      return { response, body: await response.json() }
    }
    const created = await mcp('tools/call', { name: 'pencil.flows.create', arguments: {
      title: 'Synthetic resource authority proof', slug: `synthetic-pencil-${randomUUID()}`, template: 'feedback', idempotency_key: randomUUID(),
    } })
    assert.equal(created.response.status, 200)
    assert.ok(!created.body.result?.isError)
    const record = created.body.result.structuredContent
    assert.ok(record?.id)
    const links = created.body.result.content.filter(item => item.type === 'resource_link')
    assert.equal(links.length, 1, 'A record-writing tool must return its resource link')
    assert.ok(links[0].name)
    const read = await mcp('resources/read', { uri: links[0].uri })
    assert.equal(read.response.status, 200)
    const contents = read.body.result?.contents
    assert.equal(contents?.length, 1)
    assert.equal(contents[0].uri, links[0].uri)
    assert.equal(contents[0]._meta?.['com.runeditrun/untrusted'], true)
    const native = await hosted.fetch(`api/app/flows/${record.id}/draft`, { headers: { Cookie: cookie } })
    assert.equal(native.status, 200)
    const draft = await native.json()
    assert.deepEqual(JSON.parse(contents[0].text), { ...draft, stepIds: draft.steps.map(step => step.id) }, 'Resource fields must equal the native authorized builder projection')
    assert.equal(draft.flow.title, 'Synthetic resource authority proof')
    const limited = await accessToken(context, { scope: 'pencil.flows.read pencil.flows.write' })
    const refused = await mcp('resources/read', { uri: links[0].uri }, limited)
    assert.equal(refused.response.status, 403)
    assert.equal(refused.body.error?.data?.code, 'insufficient_scope')
    assert.match(refused.response.headers.get('www-authenticate') ?? '', /evidence:read/)
    assert.equal(refused.body.result, undefined, 'A refused read must expose no evidence')
    const templates = await mcp('resources/templates/list', {}, limited)
    assert.deepEqual(templates.body.result?.resourceTemplates, [])
    const stranger = await accessToken(context, { sub: randomUUID() })
    const unauthorized = await mcp('resources/read', { uri: links[0].uri }, stranger)
    assert.equal(unauthorized.response.status, 401)
    assert.equal(unauthorized.body.result, undefined)
    console.log('Pencil resources: write link, native projection, untrusted text, evidence scope and sponsor authority PASS')
  } finally { await hosted.close() }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await checkPencilResources(process.cwd(), 'deploy.json')
