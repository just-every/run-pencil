import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

test('the real built Pencil package preserves every Worker and asset payload and carries its setup and migrations', async () => {
  const parent = await mkdtemp(join(process.cwd(), '.pencil-delivery-check-'))
  try {
    const result = JSON.parse(execFileSync(process.execPath, [
      'scripts/delivery/base/cli.mjs', 'package', '--config', 'scripts/delivery/base/packaging.json',
      '--output', parent.split('/').at(-1) + '/package',
    ], { encoding: 'utf8' }))
    const manifest = JSON.parse(await readFile(result.artifact))
    const directory = result.artifact.slice(0, result.artifact.lastIndexOf('/'))
    for (const payload of [...manifest.modules, ...manifest.assets]) {
      const bytes = await readFile(join(directory, payload.payload))
      assert.equal(bytes.length, payload.size)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), payload.sha256)
    }
    assert.ok(manifest.modules.some(module => module.name === manifest.mainModule))
    const descriptor = JSON.parse(await readFile(result.project))
    const setup = await readFile(result.setup)
    assert.deepEqual(setup, await readFile('rer-setup.json'))
    assert.equal(descriptor.setup.sha256, createHash('sha256').update(setup).digest('hex'))
    assert.ok(manifest.deploymentSpec.migrations.length > 0)
    for (const migration of manifest.deploymentSpec.migrations) assert.equal(createHash('sha256').update(migration.sql).digest('hex'), migration.sha256)
    assert.equal(manifest.deploymentSpec.publicVariables.PENCIL_LOCAL_DEVELOPMENT, undefined)
    assert.notEqual(manifest.deploymentSpec.publicVariables.MAIL_PROVIDER, 'local')
    assert.notEqual(manifest.deploymentSpec.publicVariables.SEED_SAMPLE_DATA, 'true')
  } finally { await rm(parent, { recursive: true, force: true }) }
})
