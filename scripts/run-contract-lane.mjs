import { resolve } from 'node:path'
import { workerShards, runtimeLanes } from './verification-lanes.mjs'
import { runPlaywrightJson } from './browser-evidence.mjs'
import { contractLanes, writeCiContractEvidence } from './ci-contract-evidence.mjs'
import { withReleaseUpgradeInputs } from './release-upgrade-inputs.mjs'
import { runVitestJson, vitestRunSummary } from './vitest-evidence.mjs'

const root = resolve(import.meta.dirname, '..')
const [lane, directory] = process.argv.slice(2)
if (!contractLanes.includes(lane) || !directory) throw new Error('Pass a contract lane and its output directory.')
let run
if (lane === 'unit') run = await runVitestJson(root)
else if (lane.startsWith('worker-')) run = await withReleaseUpgradeInputs(root, upgrade => runVitestJson(root, { config: 'vitest.worker.config.ts', env: upgrade.env, shard: `${lane.split('-')[1]}/${workerShards}` }))
else {
  const [project, shard] = lane.split('-')
  run = await runPlaywrightJson(root, { project, shard })
}
await writeCiContractEvidence(root, resolve(directory), lane, run)
if (runtimeLanes.includes(lane)) {
  const summary = vitestRunSummary(run)
  console.log(`${lane}: ${summary.passed} passed, ${summary.failed} failed, ${summary.pending} pending; exit ${run.code}.`)
  for (const failure of summary.failures) console.error(`Runtime failure in ${failure.file}`)
} else console.log(`${lane}: ${run.report.stats.expected + run.report.stats.flaky} passed, ${run.report.stats.unexpected} failed; exit ${run.code}.`)
process.exitCode = run.code
