import assert from 'node:assert/strict'
import { randomBytes, randomUUID, webcrypto, createHash } from 'node:crypto'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const [root, main] = process.argv.slice(2).map(value => resolve(value))
const require = createRequire(join(root, 'package.json'))
const original = require.resolve('@runeditrun/rer/internal/cli/hosted-output.mjs')
const harness = join(dirname(original), `legacy-upgrade-${randomUUID()}.mjs`)
// Extend the installed disposable-host helper locally, preserving its native
// Miniflare bindings/migrator. No production source or database test door changes.
const extension = `  upgrade: async (nextRoot, through = '9999') => {
   const nextBuild = join(nextRoot, 'dist/server'), nextClient = join(nextRoot, 'dist/client');
   const nextConfig = await read(join(nextBuild, 'wrangler.json'));
   const nextEntry = join(nextBuild, nextConfig.main);
   const app = options.workers.find(worker => worker.name === 'app');
   app.modules = [nextEntry, ...(await files(nextBuild)).map(path => join(nextBuild, path)).filter(path => path !== nextEntry && moduleTypes[extname(path)])]
    .map(path => ({ type: moduleTypes[extname(path)], path }));
   app.modulesRoot = nextBuild;
   app.compatibilityDate = nextConfig.compatibility_date;
   app.compatibilityFlags = nextConfig.compatibility_flags;
   if (app.assets) app.assets.directory = nextClient;
   await mf.setOptions(convertV4MiniflareOptions(options));
   loopback = await mf.ready;
   const { unstable_splitSqlQuery: split } = createRequire(join(nextRoot, 'package.json'))('wrangler');
   for (const item of nextConfig.d1_databases ?? []) {
    const directory = resolve(nextBuild, item.migrations_dir ?? 'migrations'), plan = [];
    for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql') && name.slice(0,4) <= through).sort()) {
     const sql = await readFile(join(directory, name), 'utf8');
     plan.push({ name, sql, sha256: createHash('sha256').update(sql).digest('hex'), statements: split(sql) });
    }
    await migrate(await mf.getD1Database(item.binding, 'app'), withRewrites(plan, await readMigrationRewrites(nextRoot), { partial: true }));
   }
  },
`
const source = await readFile(original, 'utf8')
assert.equal(source.split('  rebind: async names => {').length, 2)
await writeFile(harness, source.replace('  rebind: async names => {', extension + '  rebind: async names => {'))
async function probe(fixed) {
let hosted
try {
  const { serveHosted, HOSTED_ORIGIN } = await import(pathToFileURL(harness))
  const { signJws, seconds, policyEnvelope, autonomousPolicy, heldPolicy, accessToken } = await import(pathToFileURL(require.resolve('@runeditrun/rer/internal/modules/agent-door/conformance/crypto.mjs')))
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const kid = randomUUID(), installationId = randomUUID(), issuer = `https://legacy-pencil-${randomUUID()}.invalid`
  const email = 'synthetic-legacy@example.invalid', sub = randomUUID(), business = 'synthetic-legacy-business'
  const { kty, crv, x, y } = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
  const keys = { [kid]: { kty, crv, x, y, kid, alg: 'ES256', use: 'sig' } }
  hosted = await serveHosted(main, { declaration: 'deploy.json', outboundService: () => new Response(null, { status: 503 }), bindings: {
    RER_OWNER_CLAIM_ISSUER: issuer, RER_OWNER_CLAIM_INSTALLATION_ID: installationId,
    RER_OWNER_CLAIM_APP_ORIGIN: HOSTED_ORIGIN, RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify(keys),
    RER_BUSINESS_TRUST: JSON.stringify({ v: 1, issuer, audience: HOSTED_ORIGIN, subject: installationId, email, keys }),
    MAIL_FROM: email, OWNER_EMAIL: email, SEED_ADMIN_EMAIL: email, SETUP_TOKEN: randomBytes(32).toString('hex'),
  } })
  const sign = (typ, payload) => signJws(pair.privateKey, kid, typ, payload)
  const post = (path, body, person = false) => hosted.fetch(path.replace(/^\//, ''), { method: 'POST', headers: {
    Origin: HOSTED_ORIGIN, 'Content-Type': 'application/json', ...(person ? { Cookie: cookie } : {}),
  }, body: JSON.stringify(body) })
  const personGet = async path => {
    const response = await hosted.fetch(path.replace(/^\//, ''), { headers: { Cookie: cookie } })
    assert.equal(response.status, 200)
    return response.json()
  }
  const iat = seconds()
  const claim = await sign('rer-owner-claim+jwt', { v: 1, iss: issuer, aud: HOSTED_ORIGIN, installationId, email, jti: randomUUID(), iat, exp: iat + 300 })
  const admitted = await post('/auth/owner-claim', { token: claim, displayName: 'Synthetic legacy owner', returnTo: '/' })
  assert.equal(admitted.status, 303)
  const cookie = admitted.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
  await admitted.body?.cancel()
  const context = { signer: { privateKey: pair.privateKey, kid, installationId, issuer }, origin: HOSTED_ORIGIN,
    person: { sub, email }, business, consent: randomUUID(), agentId: randomUUID(), seq: 0, revision: 0,
    surface: { specialist: 'form-design', tools: [{ scope: 'pencil.flows.read' }, { scope: 'pencil.flows.write' }] }, resourceScopes: ['evidence:read'] }
  async function settings(rev, detached = false) {
    const now = seconds()
    const settings = await sign('rer-business-settings+jwt', { v: 1, iss: issuer, aud: HOSTED_ORIGIN, sub: installationId,
      business, email, owner_id: sub, jti: randomUUID(), iat: now, exp: now + 300, rev, values: {}, logo: null, team: null, ...(detached ? { detached: true } : {}) })
    const response = await post('/api/rer/business-settings', { settings })
    assert.equal(response.status, 200, `Signed settings revision ${rev} must be admitted`)
    assert.equal((await response.json()).rev, rev)
  }
  async function policy(document, revision) {
    const envelope = await policyEnvelope(context, document, { seq: revision, revision })
    const response = await post('/api/rer/agent-policy', { policy: envelope.policy })
    assert.equal(response.status, 200)
    await response.body?.cancel()
  }
  await settings(1)
  await policy(autonomousPolicy(), 1)
  const token = await accessToken(context)
  let id = 0
  async function tool(name, args) {
    const response = await hosted.fetch('mcp', { method: 'POST', headers: {
      Origin: HOSTED_ORIGIN, Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
      'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'tools/call', 'Mcp-Name': name,
    }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args,
      _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }) })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.ok(!body.error && !body.result?.isError, JSON.stringify(body))
    return body.result
  }
  const drafts = []
  for (let n = 0; n < (fixed ? 3 : 1); n++) {
    const created = await tool('pencil.flows.create', { title: `Synthetic legacy ${n}`, slug: `legacy-${randomUUID()}`, template: 'feedback', idempotency_key: randomUUID() })
    const draft = await personGet(`/api/app/flows/${created.structuredContent.id}/draft`)
    assert.equal(draft.flow.status, 'draft')
    drafts.push(draft)
  }
  await policy(heldPolicy(), 2)
  async function hold(draft) {
    const result = await tool('pencil.flows.publish', { flowId: draft.flow.id, expectedVersion: draft.flow.draftVersion,
      expected_revision: draft.flow.draftVersion, idempotency_key: randomUUID() })
    const handle = result._meta?.['com.runeditrun/approval']
    assert.ok(handle?.id)
    const { approval } = await personGet(`/agents/api/approvals/${handle.id}`)
    assert.equal(approval.state, 'pending')
    return { approval, draft }
  }
  const legacy = []
  for (const draft of drafts.slice(0, fixed ? 2 : 1)) legacy.push(await hold(draft))
  async function saved(handle) {
    return (await (await hosted.database('DB')).prepare('SELECT saved FROM agent_door_approvals WHERE id=?').bind(handle.approval.id).first()).saved
  }
  for (const handle of legacy) assert.equal(Object.hasOwn(JSON.parse(await saved(handle)).principal, 'source'), false,
    'Main Worker must actually persist an untagged principal')
  const audits = async () => (await (await hosted.database('DB')).prepare('SELECT * FROM agent_door_audit ORDER BY sequence').all()).results
  const mainAudit = await audits()
  await hosted.upgrade(root, '0078')
  assert.deepEqual(await audits(), mainAudit, '0077/0078 retain all original audit bytes')
  async function approve(handle) {
    const { approval, draft } = handle
    const response = await post(`/agents/api/approvals/${approval.id}/approve`, {
      revision: approval.revision, summary_sha256: approval.summary_sha256,
    }, true)
    const body = await response.json()
    const native = await personGet(`/api/app/flows/${draft.flow.id}/draft`)
    return { http: response.status, state: body.approval?.state, code: body.approval?.code, form: native.flow.status }
  }
  if (!fixed) {
    await settings(2, true)
    const before = await approve(legacy[0])
    assert.deepEqual(before, { http: 200, state: 'executed', code: null, form: 'open' })
    console.log(`PROBE legacy-upgrade: before bd597801ed2d13626ee5898c3bc91cb55cdf1edd ${JSON.stringify(before)} (reproduced blocking A)`)
    return { before, legacyPrincipalsCreatedOnMain: legacy.length, mainAuditRowsPreserved: mainAudit.length }
  }
  const auditBefore = await audits()
  const remaining = await Promise.all(legacy.map(saved))
  await hosted.upgrade(root)
  assert.deepEqual(await audits(), auditBefore, '0079 must preserve all audit bytes')
  for (const [n, handle] of legacy.entries()) {
    const expected = JSON.parse(remaining[n]); expected.principal.source = 'business'
    assert.deepEqual(JSON.parse(await saved(handle)), expected, 'Only legacy principal source changes')
  }
  const running = await approve(legacy[0])
  assert.deepEqual(running, { http: 200, state: 'executed', code: null, form: 'open' })
  const fresh = await hold(drafts[2])
  assert.equal(JSON.parse(await saved(fresh)).principal.source, 'business')
  await settings(2, true)
  const after = await approve(legacy[1]), current = await approve(fresh)
  for (const outcome of [after, current]) assert.deepEqual(outcome, {
    http: 200, state: 'refused', code: 'sponsor_unavailable', form: 'draft',
  })
  const ledger = (await (await hosted.database('DB')).prepare('SELECT name FROM _rer_deploy_migrations ORDER BY rowid').all()).results
  assert.ok(ledger.some(row => row.name.endsWith('0079_agent_door_legacy_principals.sql')))
  const receipt = { schema: 1, installation: 'one disposable native Miniflare D1 installation for the fixed upgrade and all three controls',
    mainHead: process.env.PROBE_MAIN_HEAD, beforeHead: 'bd597801ed2d13626ee5898c3bc91cb55cdf1edd',
    legacyPrincipalsCreatedOnMain: legacy.length, lackedSource: true, after, running, postUpgradeHeld: current,
    signedDetachmentHttp: 200, auditsPreserved: { mainUpgrade: mainAudit.length, forwardRepair: auditBefore.length,
      sha256: createHash('sha256').update(JSON.stringify(auditBefore)).digest('hex') }, migrationLedgerEntries: ledger.length }
  console.log(`PROBE legacy-upgrade: after ${JSON.stringify(after)}; running ${JSON.stringify(running)}; new held ${JSON.stringify(current)}; audit bytes preserved ${auditBefore.length}/${auditBefore.length}`)
  return receipt
} finally {
  await hosted?.close()
}
}

try {
  // Detachment is intentionally terminal. Use a separate before-fix control;
  // the fixed legacy upgrade, running control and new held call share one D1
  // installation. No private settings are reset and no principal is fabricated.
  const baseline = await probe(false)
  const fixed = await probe(true)
  await writeFile(new URL('./legacy-upgrade-receipt.json', import.meta.url), JSON.stringify({ ...fixed, before: baseline.before,
    baselineLegacyPrincipalsCreatedOnMain: baseline.legacyPrincipalsCreatedOnMain,
    baselineMainAuditRowsPreserved: baseline.mainAuditRowsPreserved,
    baselineInstallation: 'separate disposable native control because signed detachment is terminal' }, null, 2) + '\n')
} finally { await unlink(harness) }
