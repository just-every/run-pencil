import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID, webcrypto } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { unstable_splitSqlQuery } from 'wrangler'
import { createBackupManifest } from '../../scripts/deployment-data-browser-manifest.mjs'
import { accessToken, autonomousPolicy, heldPolicy, policyEnvelope, seconds, signJws } from '@runeditrun/rer/internal/modules/agent-door/conformance/crypto.mjs'

// This is the actual last main ancestor before Pencil refreshed past the old
// agent door. Its credentials persist consent but no principal.source. Keep the
// historical implementation intact: generating a modern approval then deleting
// source would not establish the upgrade path this regression protects.
const predecessor = 'ae8ee162c63e3b970d7ee61eec82614bcf9e2c06'
const origin = 'https://legacy-approval.pencil.test'
const require = createRequire(import.meta.url)
const tools = createRequire(require.resolve('wrangler/package.json'))
const { Miniflare } = tools('miniflare')
const { build } = tools('esbuild')

async function bundle(root, dependencies) {
  const modules = await build({
    stdin: { sourcefile: 'legacy-approval-entry.ts', resolveDir: root, loader: 'ts', contents: `
      import { workerApp, initializePencil } from './src/core/app/worker.ts';
      import { createPencilPlatform } from './src/core/platform/runtime.ts';
      import { pencilAgentDoor, capabilities, notTools } from './src/agent-door/index.ts';
      import { pencilPeople } from './src/agent-door/people.ts';
      import { pencilTrust } from './src/agent-door/trust.ts';
      import { flowTools, flowResources } from './src/agent-door/flow-tools.ts';
      import { createAgentDoor } from './src/base/agent-door/index.ts';
      export default { async fetch(request, env, execution) {
        const platform = createPencilPlatform(request.url, env);
        const services = await initializePencil(platform);
        // A harness adapter for the public embedded invocation API. It is not a
        // production route and does not alter admission, policy or execution.
        if (new URL(request.url).pathname === '/__probe/embedded') {
          const session = await services.auth.getSession(request);
          if (!session) return new Response(null, { status: 401 });
          const { people, nativeOperator } = pencilPeople(env.DB, services);
          const door = createAgentDoor({ seed: 'pencil', name: 'Pencil', specialist: 'form-design',
            db: env.DB, origin: platform.configuration.appOrigin, trust: pencilTrust(platform), capabilities,
            people, tools: flowTools(services, nativeOperator), resources: flowResources(services, nativeOperator), notTools });
          const { name, args } = await request.json();
          return Response.json(await door.invoke(name, args, { person: { id: session.operatorId },
            agent: { id: 'synthetic-embedded-agent', name: 'Synthetic embedded agent' },
            scopes: ['pencil.flows.read', 'pencil.flows.write'] }));
        }
        const response = await pencilAgentDoor(env, platform, services).handle(request);
        return response ?? workerApp.fetch(request, env, execution);
      } };
    ` },
    bundle: true, write: false, loader: { '.css': 'empty' }, platform: 'browser', format: 'esm', target: 'es2022',
    nodePaths: [join(dependencies, 'node_modules')], external: ['node:*', 'cloudflare:*'], logLevel: 'silent',
    plugins: [{ name: 'native-assets', setup(builder) {
      builder.onResolve({ filter: /^virtual:pencil-backup-manifest$/ }, () => ({ path: 'backup-manifest', namespace: 'manifest' }))
      builder.onLoad({ filter: /.*/, namespace: 'manifest' }, () => ({ contents: `export default ${JSON.stringify(createBackupManifest())};`, loader: 'js' }))
      builder.onResolve({ filter: /\?raw$/ }, args => ({ path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw' }))
      builder.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }))
    } }],
  })
  return modules.outputFiles[0].text
}

async function migrate(db, directory, names) {
  for (const name of names) {
    const statements = unstable_splitSqlQuery(await readFile(join(directory, name), 'utf8'))
    await db.batch(statements.map(statement => db.prepare(statement)))
  }
}

export async function checkLegacyApprovals(root = process.cwd()) {
  const temporary = await mkdtemp(join(tmpdir(), 'pencil-legacy-approvals-'))
  let runtime
  try {
    const historical = join(temporary, 'historical')
    await mkdir(historical)
    execFileSync('tar', ['-xf', '-', '-C', historical], { input: execFileSync('git', ['archive', predecessor, 'src', 'scripts', 'sample-data', 'migrations', 'seed.json', 'package.json', 'tsconfig.app.json'], { cwd: root, maxBuffer: 256 * 1024 * 1024 }), maxBuffer: 1024 * 1024 })
    const oldPackage = JSON.parse(await readFile(join(historical, 'package.json'), 'utf8'))
    assert.equal(oldPackage.devDependencies['@runeditrun/rer'], '0.2.94')
    const oldCredentials = await readFile(join(historical, 'src/base/agent-door/credentials.ts'), 'utf8')
    assert.ok(!oldCredentials.includes("source: 'business'"), 'The historical producer must predate persisted principal source')
    const oldBundle = await bundle(historical, root)
    console.log('Pencil legacy approvals: unchanged historical native worker compiled')
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const kid = randomUUID(), installationId = randomUUID(), issuer = 'https://synthetic-legacy-business.invalid'
    const email = 'synthetic-pencil-legacy@example.invalid', sub = randomUUID(), business = 'synthetic-legacy-business'
    const { kty, crv, x, y } = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
    const keys = { [kid]: { kty, crv, x, y, kid, alg: 'ES256', use: 'sig' } }
    const bindings = { APP_ORIGIN: origin, SESSION_SECRET: randomBytes(32).toString('hex'), SETUP_TOKEN: randomBytes(32).toString('hex'),
      SEED_ADMIN_EMAIL: email, MAIL_FROM: email, MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'synthetic-test-only',
      RER_OWNER_CLAIM_ISSUER: issuer, RER_OWNER_CLAIM_INSTALLATION_ID: installationId,
      RER_OWNER_CLAIM_APP_ORIGIN: origin, RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify(keys),
      RER_BUSINESS_TRUST: JSON.stringify({ v: 1, issuer, audience: origin, subject: installationId, email, keys }) }
    const assets = join(temporary, 'assets')
    await mkdir(assets)
    const options = contents => ({ cf: false, upstream: origin, resourcePersistencePath: join(temporary, 'state'), workers: [{
      config: { type: 'worker', name: 'legacy-approvals', compatibilityDate: '2026-09-08', compatibilityFlags: ['nodejs_compat'],
        manifest: { mainModule: 'probe.mjs', modulesRoot: temporary, modules: { 'probe.mjs': { type: 'esm', contents } } },
        env: { ...Object.fromEntries(Object.entries(bindings).map(([name, value]) => [name, { type: 'text', value }])),
          DB: { type: 'd1', id: 'legacy-approvals' }, FORM_ASSETS: { type: 'r2', name: 'legacy-approval-assets' }, ASSETS: { type: 'assets' } },
        assets: { directory: assets, runWorkerFirst: true, hasUserWorker: true } },
      dev: { outboundService: { type: 'fetcher', handler: () => new Response(null, { status: 503 }) } },
    }] })
    runtime = new Miniflare(options(oldBundle))
    let db = await runtime.getD1Database('DB')
    const oldMigrations = (await readdir(join(historical, 'migrations/core'))).filter(name => name.endsWith('.sql')).sort()
    await migrate(db, join(historical, 'migrations/core'), oldMigrations)
    console.log('Pencil legacy approvals: historical native Miniflare D1 migrated')
    const sign = (typ, payload) => signJws(pair.privateKey, kid, typ, payload)
    let cookie
    const request = (path, body, method = body === undefined ? 'GET' : 'POST', extra = {}) => runtime.dispatchFetch(origin + path, {
      method, redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    async function json(path, body, expected = 200, method) {
      const response = await request(path, body, method)
      assert.equal(response.status, expected, `${path} must return ${expected}: ${response.status}`)
      return response.json()
    }
    const claimTime = seconds()
    const admitted = await request('/auth/owner-claim', { token: await sign('rer-owner-claim+jwt', {
      v: 1, iss: issuer, aud: origin, installationId, email, jti: randomUUID(), iat: claimTime, exp: claimTime + 300,
    }), displayName: 'Synthetic historical Pencil owner', returnTo: '/' })
    assert.equal(admitted.status, 303, 'Historical native owner admission succeeds')
    cookie = admitted.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
    await admitted.body?.cancel()
    assert.ok(cookie)
    console.log('Pencil legacy approvals: native historical owner admitted')
    const context = { signer: { privateKey: pair.privateKey, kid, installationId, issuer }, origin, person: { sub, email },
      business, consent: randomUUID(), agentId: randomUUID(), seq: 0, revision: 0,
      surface: { specialist: 'form-design', tools: [{ scope: 'pencil.flows.read' }, { scope: 'pencil.flows.write' }] } }
    async function settings(detached, rev) {
      const iat = seconds()
      const settings = await sign('rer-business-settings+jwt', { v: 1, iss: issuer, aud: origin, sub: installationId, business,
        email, owner_id: sub, jti: randomUUID(), iat, exp: iat + 300, rev, values: {}, logo: null, team: null,
        ...(detached ? { detached: true } : {}) })
      const response = await json('/api/rer/business-settings', { settings })
      assert.equal(response.rev, rev)
    }
    await settings(false, 1)
    const policy = await policyEnvelope(context, autonomousPolicy())
    await json('/api/rer/agent-policy', { policy: policy.policy })
    const token = await accessToken(context)
    let rpcId = 0
    async function call(name, args) {
      const response = await request('/mcp', { jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args,
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }, 'POST', {
        Accept: 'application/json', Authorization: `Bearer ${token}`, 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'tools/call', 'Mcp-Name': name,
      })
      assert.equal(response.status, 200)
      const answer = await response.json()
      assert.ok(!answer.error && !answer.result?.isError, 'Historical native call must succeed')
      return answer.result
    }
    const cases = []
    for (const name of ['tagged-stopped', 'untagged-stopped', 'untagged-missing-state', 'untagged-unreadable-state', 'running', 'embedded']) {
      const result = await call('pencil.flows.create', { title: `Synthetic ${name}`, slug: `legacy-${randomUUID()}`, template: 'feedback', idempotency_key: randomUUID() })
      const draft = await json(`/api/app/flows/${result.structuredContent.id}/draft`)
      cases.push({ name, draft })
    }
    const held = await policyEnvelope(context, heldPolicy(), { seq: 2, revision: 2 })
    await json('/api/rer/agent-policy', { policy: held.policy })
    for (const item of cases.filter(item => item.name !== 'embedded')) {
      const result = await call('pencil.flows.publish', { flowId: item.draft.flow.id, expectedVersion: item.draft.flow.draftVersion,
        expected_revision: item.draft.flow.draftVersion, idempotency_key: randomUUID() })
      const handle = result._meta?.['com.runeditrun/approval']
      assert.ok(handle?.id, 'Historical publishing must wait for a human approval')
      item.approval = (await json(`/agents/api/approvals/${handle.id}`)).approval
      item.before = await db.prepare('SELECT saved FROM agent_door_approvals WHERE id=?').bind(handle.id).first('saved')
      assert.equal(JSON.parse(item.before).principal.source, undefined)
      assert.equal(JSON.parse(item.before).principal.consent, context.consent)
    }
    console.log('Pencil legacy approvals: historical public MCP saved five untagged Business approvals')
    const newMigrations = (await readdir(join(root, 'migrations/core'))).filter(name => name.endsWith('.sql') && !oldMigrations.includes(name)).sort()
    assert.deepEqual(newMigrations, ['0077_agent_door_refresh.sql', '0078_agent_door_relay_privacy.sql', '0079_agent_door_legacy_principals.sql'])
    await migrate(db, join(root, 'migrations/core'), newMigrations)
    await runtime.setOptions(options(await bundle(root, root)))
    db = await runtime.getD1Database('DB')
    console.log('Pencil legacy approvals: same D1 upgraded to candidate native worker')
    for (const item of cases.filter(item => item.approval)) {
      const upgraded = JSON.parse(await db.prepare('SELECT saved FROM agent_door_approvals WHERE id=?').bind(item.approval.id).first('saved'))
      assert.equal(upgraded.principal.source, 'business', '0079 tags every historical pending Business principal')
      const expected = JSON.parse(item.before)
      expected.principal.source = 'business'
      assert.deepEqual(upgraded, expected, 'Upgrade preserves every other saved approval field')
      if (item.name.startsWith('untagged')) await db.prepare('UPDATE agent_door_approvals SET saved=? WHERE id=?').bind(item.before, item.approval.id).run()
    }
    for (const item of cases) {
      const upgradedDraft = await json(`/api/app/flows/${item.draft.flow.id}/draft`)
      assert.equal(upgradedDraft.flow.status, 'draft', 'Upgrade keeps the prepared form unpublished')
      assert.equal(upgradedDraft.flow.draftVersion, item.draft.flow.draftVersion, 'Upgrade keeps the native draft version')
      item.draft = upgradedDraft
    }
    async function approve(item, state, code) {
      const { approval } = await json(`/agents/api/approvals/${item.approval.id}/approve`, {
        revision: item.approval.revision, summary_sha256: item.approval.summary_sha256,
      })
      assert.equal(approval.state, state, `${item.name} approval state`)
      assert.equal(approval.code, code, `${item.name} approval refusal code`)
      const after = await json(`/api/app/flows/${item.draft.flow.id}/draft`)
      if (state === 'refused') assert.deepEqual(after, item.draft, 'Refused historical approval leaves every native draft field unchanged')
      else assert.equal(after.flow.status, 'open', 'Approved native form becomes open')
      console.log(`PROBE pencil-0.2.105: POST /agents/api/approvals/:id/approve + ${item.name} ${item.name === 'embedded' ? 'public embedded invoke' : 'historical MCP'} approval -> ${state}${code ? ` ${code}; draft unchanged` : '; native form open'}`)
    }
    await approve(cases.find(item => item.name === 'running'), 'executed', null)
    const embedded = cases.find(item => item.name === 'embedded')
    const embeddedResult = await json('/__probe/embedded', { name: 'pencil.flows.publish', args: {
      flowId: embedded.draft.flow.id, expectedVersion: embedded.draft.flow.draftVersion, expected_revision: embedded.draft.flow.draftVersion, idempotency_key: randomUUID(),
    } })
    assert.equal(embeddedResult.outcome, 'pending')
    embedded.approval = (await json(`/agents/api/approvals/${embeddedResult.approval.id}`)).approval
    const embeddedSaved = JSON.parse(await db.prepare('SELECT saved FROM agent_door_approvals WHERE id=?').bind(embedded.approval.id).first('saved'))
    assert.equal(embeddedSaved.door, 'embedded')
    assert.equal(embeddedSaved.principal.source, undefined)
    assert.equal(embeddedSaved.principal.consent, undefined)
    await settings(true, 2)
    await approve(cases.find(item => item.name === 'tagged-stopped'), 'refused', 'sponsor_unavailable')
    await approve(cases.find(item => item.name === 'untagged-stopped'), 'refused', 'sponsor_unavailable')
    await approve(embedded, 'executed', null)
    await db.prepare('DELETE FROM bs_settings WHERE singleton=1').run()
    await approve(cases.find(item => item.name === 'untagged-missing-state'), 'refused', 'sponsor_unavailable')
    await db.prepare('ALTER TABLE bs_settings RENAME TO unreadable_business_settings').run()
    await approve(cases.find(item => item.name === 'untagged-unreadable-state'), 'refused', 'sponsor_unavailable')
    console.log(`Pencil legacy approvals: historical producer ${predecessor}; actual 0077–0079 upgrade; tagged and untagged stopped Business refusal, missing and unreadable state refusal, running Business and embedded controls PASS`)
  } finally {
    try { await runtime?.dispose() } finally { await rm(temporary, { recursive: true, force: true }) }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await checkLegacyApprovals()
