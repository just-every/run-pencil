import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { withReleaseUpgradeInputs } from './release-upgrade-inputs.mjs'

const checks = ['sample-row', 'graph-link', 'idempotency'].map(kind => ({ kind, query: 'SELECT 1 AS value', expectedRows: [{ value: 1 }] }))
async function repository(run) {
  const root = await mkdtemp(join(tmpdir(), 'pencil-upgrade-harness-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  try {
    git('init', '-q'); git('config', 'user.email', 'tests@example.test'); git('config', 'user.name', 'Upgrade tests')
    await mkdir(join(root, 'migrations/core'), { recursive: true })
    await mkdir(join(root, 'tests/runtime/upgrades'), { recursive: true })
    await writeFile(join(root, 'migrations/core/0000_schema.sql'), 'CREATE TABLE sample(value INTEGER);\n')
    git('add', '.'); git('commit', '-qm', 'Initial schema'); git('tag', 'v0.1.0')
    await writeFile(join(root, 'RELEASE.json'), JSON.stringify({ version: '0.2.0', previousVersion: '0.1.0' }))
    await writeFile(join(root, 'tests/runtime/upgrades/0.1.0.sql'), 'INSERT INTO sample VALUES (1);\n')
    await writeFile(join(root, 'tests/runtime/upgrades/0.1.0.json'), JSON.stringify({ checks }))
    await run(root, git)
  } finally { await rm(root, { recursive: true, force: true }) }
}

test('BASE-OPS-002 shared invocation uses exact released bytes and populated fixture; success and child failure clean inputs', async () => {
  await repository(async root => {
    let previous
    for (const fail of [false, true]) {
      let temporary
      const result = withReleaseUpgradeInputs(root, async upgrade => {
        temporary = upgrade.env.PENCIL_PREVIOUS_MIGRATIONS_DIR
        assert.notEqual(temporary, previous); previous = temporary
        assert.equal(upgrade.migrationCount, 1)
        assert.deepEqual((await readdir(temporary)).sort(), ['0000_schema.sql', 'fixture.sql.input'])
        assert.deepEqual(await readFile(join(temporary, '0000_schema.sql')), await readFile(join(root, 'migrations/core/0000_schema.sql')))
        assert.deepEqual(await readFile(upgrade.env.PENCIL_UPGRADE_FIXTURE_PATH), await readFile(join(root, 'tests/runtime/upgrades/0.1.0.sql')))
        assert.deepEqual(JSON.parse(upgrade.env.PENCIL_UPGRADE_CHECKS_JSON), checks)
        if (fail) throw new Error('Child failed')
        return 7
      })
      if (fail) await assert.rejects(result, /Child failed/)
      else assert.equal(await result, 7)
      await assert.rejects(access(temporary), { code: 'ENOENT' })
    }
  })
})

test('BASE-OPS-002 explicit empty results are valid for every required check kind and survive input forwarding', async () => {
  for (const kind of ['sample-row', 'graph-link', 'idempotency']) {
    await repository(async root => {
      const emptyChecks = checks.map(check => ({ ...check, expectedRows: check.kind === kind ? [] : check.expectedRows }))
      await writeFile(join(root, 'tests/runtime/upgrades/0.1.0.json'), JSON.stringify({ checks: emptyChecks }))
      let temporary
      assert.equal(await withReleaseUpgradeInputs(root, upgrade => {
        temporary = upgrade.env.PENCIL_PREVIOUS_MIGRATIONS_DIR
        assert.deepEqual(JSON.parse(upgrade.env.PENCIL_UPGRADE_CHECKS_JSON), emptyChecks)
        return kind
      }), kind)
      await assert.rejects(access(temporary), { code: 'ENOENT' })
    })
  }
})

test('BASE-OPS-002 shipped idempotency metadata retains its zero-row INSERT OR IGNORE RETURNING expectation', async () => {
  const { previousVersion } = JSON.parse(await readFile(new URL('../RELEASE.json', import.meta.url), 'utf8'))
  const metadata = await readFile(new URL(`../tests/runtime/upgrades/${previousVersion}.json`, import.meta.url), 'utf8')
  const releasedChecks = JSON.parse(metadata).checks
  const idempotency = releasedChecks.find(check => check.kind === 'idempotency')
  assert.match(idempotency.query, /^INSERT OR IGNORE\b[\s\S]*\bRETURNING\b/)
  assert.deepEqual(idempotency.expectedRows, [])
  await repository(async root => {
    await writeFile(join(root, 'tests/runtime/upgrades/0.1.0.json'), metadata)
    let called = false
    await withReleaseUpgradeInputs(root, upgrade => {
      called = true
      assert.deepEqual(JSON.parse(upgrade.env.PENCIL_UPGRADE_CHECKS_JSON), releasedChecks)
    })
    assert.equal(called, true)
  })
})

test('BASE-OPS-002 invalid predecessor, immutable migrations and fixtures fail before any runtime child', async () => {
  for (const mode of ['missing-tag', 'unrelated-tag', 'equal', 'invalid-version', 'invalid-previous', 'missing-fixture', 'empty-fixture', 'comment-fixture', 'missing-metadata', 'invalid-json', 'missing-check', 'duplicate-check', 'empty-query', 'invalid-rows', 'changed-migration', 'missing-migration']) {
    await repository(async (root, git) => {
      if (mode === 'missing-tag') git('tag', '-d', 'v0.1.0')
      if (mode === 'unrelated-tag') {
        git('checkout', '--orphan', 'unrelated'); git('commit', '--allow-empty', '-qm', 'Unrelated candidate')
      }
      if (mode === 'equal') await writeFile(join(root, 'RELEASE.json'), JSON.stringify({ version: '0.1.0', previousVersion: '0.1.0' }))
      if (mode === 'invalid-version') await writeFile(join(root, 'RELEASE.json'), JSON.stringify({ version: {}, previousVersion: '0.1.0' }))
      if (mode === 'invalid-previous') await writeFile(join(root, 'RELEASE.json'), JSON.stringify({ version: '0.2.0', previousVersion: '' }))
      const fixture = join(root, 'tests/runtime/upgrades/0.1.0.sql')
      const metadata = join(root, 'tests/runtime/upgrades/0.1.0.json')
      if (mode === 'missing-fixture') await rm(fixture)
      if (mode === 'empty-fixture') await writeFile(fixture, '')
      if (mode === 'comment-fixture') await writeFile(fixture, '-- INSERT INTO sample VALUES (1);')
      if (mode === 'invalid-json') await writeFile(metadata, '{')
      if (mode === 'missing-metadata') await rm(metadata)
      if (mode === 'missing-check') await writeFile(metadata, JSON.stringify({ checks: checks.slice(1) }))
      if (mode === 'duplicate-check') await writeFile(metadata, JSON.stringify({ checks: [...checks, checks[0]] }))
      if (mode === 'empty-query') await writeFile(metadata, JSON.stringify({ checks: checks.map(check => ({ ...check, query: '' })) }))
      if (mode === 'invalid-rows') await writeFile(metadata, JSON.stringify({ checks: checks.map(check => ({ ...check, expectedRows: [null] })) }))
      if (mode === 'changed-migration') await writeFile(join(root, 'migrations/core/0000_schema.sql'), '-- changed\n')
      if (mode === 'missing-migration') await rm(join(root, 'migrations/core/0000_schema.sql'))
      let called = false
      await assert.rejects(withReleaseUpgradeInputs(root, () => { called = true }))
      assert.equal(called, false, mode)
    })
  }
})

test('BASE-OPS-002 a released migration may change only as declared with both exact hashes and a later converging migration', async () => {
  const sha256 = text => createHash('sha256').update(text).digest('hex')
  const released = 'CREATE TABLE sample(value INTEGER);\n', rewritten = 'CREATE TABLE sample(value INTEGER);\n-- rewritten\n'
  const declaration = { id: '0000_schema.sql', releasedIn: '0.1.0', releasedSha256: sha256(released), sha256: sha256(rewritten), convergedBy: '0001_converge.sql', reason: 'The released text cannot be applied by the host.' }
  for (const mode of ['declared', 'undeclared', 'wrong-released-hash', 'wrong-current-hash', 'missing-converging', 'released-converging']) {
    await repository(async (root, git) => {
      if (mode === 'released-converging') {
        await writeFile(join(root, 'migrations/core/0001_converge.sql'), 'SELECT 1;\n')
        git('add', '.'); git('commit', '-qm', 'Released converging'); git('tag', '-d', 'v0.1.0'); git('tag', 'v0.1.0')
      }
      await writeFile(join(root, 'migrations/core/0000_schema.sql'), rewritten)
      if (mode !== 'missing-converging') await writeFile(join(root, 'migrations/core/0001_converge.sql'), 'SELECT 1;\n')
      const entry = { ...declaration, ...(mode === 'wrong-released-hash' ? { releasedSha256: sha256(rewritten) } : {}), ...(mode === 'wrong-current-hash' ? { sha256: sha256(released) } : {}) }
      if (mode !== 'undeclared') await writeFile(join(root, 'migrations/released-rewrites.json'), JSON.stringify([entry]))
      let forwarded
      const result = withReleaseUpgradeInputs(root, async upgrade => { forwarded = await readFile(join(upgrade.env.PENCIL_PREVIOUS_MIGRATIONS_DIR, '0000_schema.sql'), 'utf8') })
      if (mode === 'declared') { await result; assert.equal(forwarded, released) }
      else { await assert.rejects(result, /Released core migrations are immutable/, mode); assert.equal(forwarded, undefined) }
    })
  }
})

test('BASE-OPS-002 a tagless depth-1 copy reads the released migrations from the published tag and still refuses an edited one', async () => {
  for (const mode of ['published', 'changed-migration', 'no-source', 'absent-tag']) {
    await repository(async (source, git) => {
      // RER's Managed copy: one unrelated commit, no tags, cloned at depth 1, naming the release source.
      if (mode === 'absent-tag') git('tag', '-d', 'v0.1.0')
      const copy = await mkdtemp(join(tmpdir(), 'pencil-managed-copy-'))
      const origin = join(copy, 'origin'), checkout = join(copy, 'checkout')
      const inCopy = dir => (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
      try {
        await mkdir(origin)
        inCopy(origin)('init', '-q'); inCopy(origin)('config', 'user.email', 'tests@example.test'); inCopy(origin)('config', 'user.name', 'Managed copy')
        execFileSync('sh', ['-c', 'tar -C "$0" --exclude .git -cf - . | tar -x -C "$1"', source, origin])
        if (mode === 'changed-migration') await writeFile(join(origin, 'migrations/core/0000_schema.sql'), '-- changed\n')
        if (mode !== 'no-source') await writeFile(join(origin, 'rer-project.json'), JSON.stringify({ sourceRepository: `file://${source}` }))
        inCopy(origin)('add', '.'); inCopy(origin)('commit', '-qm', 'Install')
        execFileSync('git', ['clone', '-q', '--depth=1', '--no-tags', `file://${origin}`, checkout], { stdio: 'pipe' })
        assert.equal(inCopy(checkout)('tag').toString(), '')
        let forwarded
        const result = withReleaseUpgradeInputs(checkout, async upgrade => { forwarded = await readFile(join(upgrade.env.PENCIL_PREVIOUS_MIGRATIONS_DIR, '0000_schema.sql'), 'utf8') })
        if (mode === 'published') { await result; assert.equal(forwarded, 'CREATE TABLE sample(value INTEGER);\n') }
        else { await assert.rejects(result, mode === 'changed-migration' ? /Released core migrations are immutable/ : /previousVersion 0\.1\.0/, mode); assert.equal(forwarded, undefined) }
      } finally { await rm(copy, { recursive: true, force: true }) }
    })
  }
})

const invalidMetadata = [
  ['null metadata', null, /Upgrade metadata must be an object/],
  ['array metadata', [], /Upgrade metadata must be an object/],
  ['scalar metadata', 1, /Upgrade metadata must be an object/],
  ['missing checks', {}, /Upgrade metadata needs a checks array/],
  ...[null, {}, '', 1].map(value => [`non-array checks ${JSON.stringify(value)}`, { checks: value }, /Upgrade metadata needs a checks array/]),
  ['empty checks', { checks: [] }, /Upgrade metadata is missing required check/],
  ['missing expectedRows', { checks: checks.map(({ expectedRows, ...check }) => check) }, /Each upgrade check/],
  ...[null, {}, '', 1].map(value => [`non-array expectedRows ${JSON.stringify(value)}`, { checks: checks.map(check => ({ ...check, expectedRows: value })) }, /Each upgrade check/]),
  ...[null, {}, [], '', 0, false].map(value => [`invalid row value ${JSON.stringify(value)}`, { checks: checks.map(check => ({ ...check, expectedRows: [value] })) }, /Each upgrade check/]),
]
for (const [name, metadata, error] of invalidMetadata) {
  test(`BASE-OPS-002 refuses ${name} before invoking the runtime child`, async () => {
    await repository(async root => {
      await writeFile(join(root, 'tests/runtime/upgrades/0.1.0.json'), JSON.stringify(metadata))
      let called = false
      await assert.rejects(withReleaseUpgradeInputs(root, () => { called = true }), error)
      assert.equal(called, false)
    })
  })
}
