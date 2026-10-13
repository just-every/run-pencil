import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withReleaseUpgradeInputs } from './release-upgrade-inputs.mjs'
import { contractRegistry } from './contract-registry.mjs'
import { runVitestJson, vitestPassedTests, vitestRunSummary } from './vitest-evidence.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
await withReleaseUpgradeInputs(root, async upgrade => {
  if (upgrade.firstRelease) {
    console.log('First-release migration gate: the Worker D1 suite proves migration from an empty database.')
    return
  }
  const file = resolve(root, 'tests/runtime/upgrades.worker.test.ts')
  const registry = await contractRegistry(root)
  const expected = new Set([...registry.values()].flatMap(entry => entry.covered).filter(test => test.file === file).map(test => `${test.file}\u0000${test.title}`))
  if (expected.size !== 3) throw new Error('Upgrade evidence must register all three native cases.')
  const run = await runVitestJson(root, { config: 'vitest.worker.config.ts', files: ['tests/runtime/upgrades.worker.test.ts'], env: upgrade.env })
  const passed = vitestPassedTests(run.report)
  const summary = vitestRunSummary(run)
  console.log(`Workers D1 upgrade from ${upgrade.tag}: ${upgrade.migrationCount} released migrations; ${summary.passed} passed, ${summary.failed} failed, ${summary.pending} pending.`)
  if (run.code !== 0) { process.exitCode = run.code; console.error(run.stderr.trim()); return }
  if ([...expected].some(test => !passed.has(test))) throw new Error('Workers D1 upgrade evidence is missing a passing native case with its registered file and title.')
})
