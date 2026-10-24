import { resolve } from 'node:path'
import { workerShards, runtimeLanes, archiveLanes } from './verification-lanes.mjs'
import { runPlaywrightJson } from './browser-evidence.mjs'
import { contractLanes, writeCiContractEvidence } from './ci-contract-evidence.mjs'
import { withReleaseUpgradeInputs } from './release-upgrade-inputs.mjs'
import { runVitestJson, vitestRunSummary } from './vitest-evidence.mjs'

const root = resolve(import.meta.dirname, '..')
const [lane, directory] = process.argv.slice(2)
if (!contractLanes.includes(lane) || !directory) throw new Error('Pass a contract lane and its output directory.')
let run
if (lane === 'unit') run = await runVitestJson(root, { exclude: ['tests/contract/data-release.contract.test.ts'] })
else if (archiveLanes.includes(lane)) {
  const group = lane.slice('archive-'.length)
  const started = performance.now()
  console.log(`Archive group ${group}: started.`)
  run = await runVitestJson(root, { files: ['tests/contract/data-release.contract.test.ts'], env: { PENCIL_ARCHIVE_GROUP: group } })
  console.log(`Archive group ${group}: ${run.code === 0 ? 'passed' : 'failed'} in ${((performance.now() - started) / 1000).toFixed(3)} s.`)
}
else if (lane.startsWith('worker-')) {
  const started = performance.now()
  run = await withReleaseUpgradeInputs(root, upgrade => runVitestJson(root, { config: 'vitest.worker.config.ts', env: upgrade.env, shard: `${lane.split('-')[1]}/${workerShards}` }))
  if (lane === 'worker-2') {
    const capacity = await runVitestJson(root, {
      config: 'vitest.release.config.ts',
      reporters: ['verbose', 'json'],
      files: ['tests/release/ledger-search.worker.test.ts'],
      env: { PENCIL_RUN_LOAD: '1', PENCIL_LOAD_MODE: '1' },
    })
    for (const line of (capacity.stdout + '\n' + capacity.stderr).split('\n')) if (line.includes('PENCIL_SEARCH_CAPACITY ')) console.log(line)
    const summary = vitestRunSummary(capacity)
    // A skipped or missing capacity registration must never earn lane evidence.
    const passed = summary.passed === 1 && summary.failed === 0 && summary.pending === 0
    run = { ...run, code: run.code || capacity.code || (passed ? 0 : 1),
      report: { ...run.report, testResults: [...run.report.testResults, ...capacity.report.testResults] } }
  }
  console.log(`${lane}: completed in ${((performance.now() - started) / 1000).toFixed(3)} s.`)
}
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
