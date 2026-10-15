import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contractRegistry } from './contract-registry.mjs'
import { withReleaseUpgradeInputs } from './release-upgrade-inputs.mjs'
import { runVitestJson, vitestPassedTests, vitestRunSummary } from './vitest-evidence.mjs'
import { runPlaywrightJson } from './browser-evidence.mjs'
import { readCiContractEvidence } from './ci-contract-evidence.mjs'
import { readProfile } from './contract-profile.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

async function clauses(path) {
  const document = await readFile(resolve(root, path), 'utf8')
  return [...document.matchAll(/^- \*\*([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})\s+—/gm)].map((match) => match[1])
}

async function supersededBaselineClauses() {
  const document = await readFile(resolve(root, 'CONTRACT.md'), 'utf8')
  return new Map([...document.matchAll(/^- \*\*([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})\s+—[^\n]*\*Supersedes `([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})`/gm)].map((match) => [match[2], match[1]]))
}

const [registry, ids, superseded] = await Promise.all([
  contractRegistry(root),
  Promise.all([clauses('CONTRACT.md'), clauses('BASELINE.md')]).then(([contract, baseline]) => [...new Set([...contract, ...baseline])]),
  supersededBaselineClauses(),
])

const profileMode = process.argv[2] ?? 'first-release'
const deferred = await readProfile(root, ids, profileMode)
const browserContracts = [...registry.values()].flatMap((entry) => entry.covered).filter((entry) => entry.browser)
// Local verification extracts fresh predecessor inputs. CI accepts only every lane
// from this commit and this run attempt.
const ci = process.env.PENCIL_CONTRACT_EVIDENCE_DIR
  ? await readCiContractEvidence(root, process.env.PENCIL_CONTRACT_EVIDENCE_DIR) : undefined
const runtime = ci?.runtime ?? await withReleaseUpgradeInputs(root, async (upgrade) => [
  await runVitestJson(root),
  await runVitestJson(root, { config: 'vitest.worker.config.ts', env: upgrade.env }),
])
const browserRuntime = ci?.browserRuntime ?? (browserContracts.length > 0 ? await runPlaywrightJson(root) : undefined)
for (const [index, run] of runtime.entries()) {
  const summary = vitestRunSummary(run)
  console.log(`${index === 0 ? 'Unit' : 'Worker'} evidence: ${summary.passed} passed, ${summary.failed} failed, ${summary.pending} pending; exit ${summary.code}.`)
  for (const failure of summary.failures) {
    const trace = failure.messages.join('\n').match(/([^\s()]+\.(?:mjs|js|tsx|ts)):(\d+):(\d+)/)
    console.error(`Runtime failure: ${trace?.[1] ?? failure.file}:${trace?.[2] ?? '?'}:${trace?.[3] ?? '?'}`)
  }
}
if (browserRuntime) {
  const stats = browserRuntime.report.stats
  console.log(`Browser evidence: ${stats.expected + stats.flaky} passed, ${stats.unexpected} failed, ${stats.skipped} pending; exit ${browserRuntime.code}.`)
}
const passedTests = new Set()
for (const run of runtime) {
  for (const passed of vitestPassedTests(run.report)) passedTests.add(passed)
}
for (const passed of browserRuntime?.passed ?? []) passedTests.add(passed)

const missing = []
const todo = []
const partial = []
const failed = []
const covered = []
const overridden = []
for (const id of ids) {
  if (deferred.has(id)) continue
  const entry = registry.get(id)
  if (!entry && superseded.has(id)) {
    overridden.push(`${id} by ${superseded.get(id)}`)
    continue
  }
  if (!entry) {
    missing.push(id)
    continue
  }
  if (entry.todo.length > 0) {
    if (entry.covered.some(test => test.title && passedTests.has(`${test.file}\u0000${test.title}`))) partial.push(id)
    todo.push(id)
    continue
  }
  const runnable = entry.covered.filter((test) => test.title && passedTests.has(`${test.file}\u0000${test.title}`))
  if (runnable.length !== entry.covered.length || runnable.length === 0) {
    failed.push(id)
    continue
  }
  covered.push(id)
}

if (process.env.PENCIL_CONTRACT_REPORT) await writeFile(process.env.PENCIL_CONTRACT_REPORT, JSON.stringify({ runs: { vitest: runtime.map(vitestRunSummary), playwright: browserRuntime?.report }, profile: profileMode, covered, partial, todo, deferred: [...deferred], missing, failed, overridden, clauses: Object.fromEntries(ids.map(id => [id, { status: deferred.has(id) ? 'deferred' : covered.includes(id) ? 'covered' : partial.includes(id) ? 'partial' : todo.includes(id) ? 'todo' : overridden.some(value => value.startsWith(id + ' ')) ? 'superseded' : 'uncovered', evidence: (registry.get(id)?.covered ?? []).map(test => ({ file: test.file.slice(root.length + 1), title: test.title, passed: passedTests.has(`${test.file}\u0000${test.title}`) })) }])) }, null, 2) + '\n')
console.log(`Partially evidenced but still active TODO: ${partial.join(', ')}`)
console.log(`Contract coverage: ${covered.length} runtime-covered, ${deferred.size} explicitly deferred (${profileMode}), ${todo.length} todo, ${overridden.length} superseded, ${missing.length} untracked, ${failed.length} not-passing, ${ids.length} declared.`)
console.log(`Passing clauses: ${covered.join(', ')}`)
if (deferred.size > 0) console.log(`Deferred (not satisfied): ${[...deferred].join(', ')}`)
if (overridden.length > 0) console.log(`Superseded baseline clauses: ${overridden.join(', ')}`)
if (todo.length > 0) console.error(`TODO clauses: ${todo.join(', ')}`)
if (missing.length > 0) console.error(`Untracked clauses: ${missing.join(', ')}`)
if (failed.length > 0) console.error(`No passing tagged runtime test: ${failed.join(', ')}`)
const failedRun = runtime.find((run) => run.code !== 0)
if (failedRun) console.error(`Vitest did not pass while evaluating the contract registry.${failedRun.stderr ? ` ${failedRun.stderr.trim()}` : ''}`)
if (browserRuntime && browserRuntime.code !== 0) console.error(`Playwright did not pass while evaluating browser contract coverage.${browserRuntime.stderr ? ` ${browserRuntime.stderr.trim()}` : ''}`)
if (todo.length > 0 || missing.length > 0 || failed.length > 0 || failedRun || (browserRuntime && browserRuntime.code !== 0)) {
  console.error('Release verification refuses contract TODO, untracked clauses, or tests without a passing runtime result.')
  process.exit(1)
}
