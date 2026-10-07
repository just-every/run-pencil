import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import ts from 'typescript'
import { playwrightPassedTests } from './contract-evidence.mjs'
import { readProfile } from './contract-profile.mjs'

const root = resolve(new URL('..', import.meta.url).pathname)

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : collectTestFiles(path)
    return /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : []
  }))
  return files.flat()
}

async function clauses(path) {
  const document = await readFile(resolve(root, path), 'utf8')
  return [...document.matchAll(/^- \*\*([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})\s+—/gm)].map((match) => match[1])
}

async function supersededBaselineClauses() {
  const document = await readFile(resolve(root, 'CONTRACT.md'), 'utf8')
  return new Map([...document.matchAll(/^- \*\*([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})\s+—[^\n]*\*Supersedes `([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})`/gm)].map((match) => [match[2], match[1]]))
}

function stringArgument(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined
}

async function contractRegistry() {
  const files = (await Promise.all(['tests', 'src'].map((directory) => collectTestFiles(resolve(root, directory))))).flat()
  const registry = new Map()

  for (const file of files) {
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'contract') {
        const argument = node.arguments[0]
        const ids = ts.isArrayLiteralExpression(argument) ? argument.elements.map(stringArgument) : [stringArgument(argument)]
        if (ids.length && ids.every(Boolean)) {
          const name = stringArgument(node.arguments[1])
          for (const id of ids) {
            const entry = registry.get(id) ?? { covered: [], todo: [] }
            entry.covered.push({ file, title: name ? `[${ids.join(',')}] ${name}` : undefined, browser: file.startsWith(resolve(root, 'tests/e2e')) })
            registry.set(id, entry)
          }
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'contract' && node.expression.name.text === 'todo') {
        const id = stringArgument(node.arguments[0])
        if (id) {
          const entry = registry.get(id) ?? { covered: [], todo: [] }
          entry.todo.push(file)
          registry.set(id, entry)
        }
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(source, visit)
  }
  return registry
}

async function runVitestJson(config) {
  const directory = await mkdtemp(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-contract-coverage-'))
  const output = join(directory, 'results.json')
  try {
    const result = await new Promise((resolveResult, reject) => {
      const args = ['./node_modules/vitest/vitest.mjs', 'run', '--reporter=json', '--outputFile', output]
      if (config) args.push('--config', config)
      const child = spawn(process.execPath, args, {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      // Reporters write their result file; always drain diagnostic stdout so a full pipe cannot stall the child.
      child.stdout.resume()
      let stderr = ''
      child.stderr.on('data', (chunk) => { stderr += chunk })
      child.on('error', reject)
      child.on('close', (code) => resolveResult({ code, stderr }))
    })
    const report = JSON.parse(await readFile(output, 'utf8'))
    return { ...result, report }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function runPlaywrightJson() {
  const directory = await mkdtemp(join(process.env.PENCIL_VERIFICATION_TMPDIR ?? tmpdir(), 'pencil-browser-contract-coverage-'))
  const output = join(directory, 'results.json')
  try {
    const result = await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, ['scripts/run-browser-checks.mjs', output], {
        cwd: root,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: output },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      // Reporters write their result file; always drain diagnostic stdout so a full pipe cannot stall the child.
      child.stdout.resume()
      let stderr = ''
      child.stderr.on('data', (chunk) => { stderr += chunk })
      child.on('error', reject)
      child.on('close', (code) => resolveResult({ code, stderr }))
    })
    const report = JSON.parse(await readFile(output, 'utf8'))
    return { ...result, report, passed: playwrightPassedTests(report) }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

const [registry, ids, superseded] = await Promise.all([
  contractRegistry(),
  Promise.all([clauses('CONTRACT.md'), clauses('BASELINE.md')]).then(([contract, baseline]) => [...new Set([...contract, ...baseline])]),
  supersededBaselineClauses(),
])

const profileMode = process.argv[2] ?? 'first-release'
const deferred = await readProfile(root, ids, profileMode)
const browserContracts = [...registry.values()].flatMap((entry) => entry.covered).filter((entry) => entry.browser)
const runtime = [await runVitestJson(), await runVitestJson('vitest.worker.config.ts')]
const browserRuntime = browserContracts.length > 0 ? await runPlaywrightJson() : undefined
const passedTests = new Set()
for (const run of runtime) {
  for (const file of run.report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status === 'passed') passedTests.add(`${file.name}\u0000${assertion.title}`)
    }
  }
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

if (process.env.PENCIL_CONTRACT_REPORT) await writeFile(process.env.PENCIL_CONTRACT_REPORT, JSON.stringify({ runs: { vitest: runtime.map(run => ({ code: run.code, passed: run.report.numPassedTests, failed: run.report.numFailedTests, pending: run.report.numPendingTests, failures: run.report.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => ({ file: file.name, title: test.title, messages: test.failureMessages }))) })), playwright: browserRuntime?.report }, profile: profileMode, covered, partial, todo, deferred: [...deferred], missing, failed, overridden, clauses: Object.fromEntries(ids.map(id => [id, { status: deferred.has(id) ? 'deferred' : covered.includes(id) ? 'covered' : partial.includes(id) ? 'partial' : todo.includes(id) ? 'todo' : overridden.some(value => value.startsWith(id + ' ')) ? 'superseded' : 'uncovered', evidence: (registry.get(id)?.covered ?? []).map(test => ({ file: test.file.slice(root.length + 1), title: test.title, passed: passedTests.has(`${test.file}\u0000${test.title}`) })) }])) }, null, 2) + '\n')
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
