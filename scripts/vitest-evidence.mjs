import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export function vitestPassedTests(report) {
  if (!Array.isArray(report.testResults)) throw new Error('Vitest evidence needs testResults.')
  const outcomes = new Map()
  for (const file of report.testResults) {
    for (const test of file.assertionResults ?? []) {
      const key = `${file.name}\u0000${test.title}`
      outcomes.set(key, (outcomes.get(key) ?? true) && test.status === 'passed')
    }
  }
  return new Set([...outcomes].filter(([, passed]) => passed).map(([key]) => key))
}

export function vitestRunSummary(run) {
  const unique = new Map()
  const priority = status => status === 'failed' ? 2 : status === 'passed' ? 0 : 1
  for (const file of run.report.testResults) {
    for (const test of file.assertionResults ?? []) {
      const key = `${file.name}\u0000${test.title}`
      const previous = unique.get(key)
      if (!previous || priority(test.status) > priority(previous.status)) unique.set(key, { file: file.name, ...test })
    }
  }
  const assertions = [...unique.values()]
  return { code: run.code, passed: assertions.filter(test => test.status === 'passed').length,
    failed: assertions.filter(test => test.status === 'failed').length,
    pending: assertions.filter(test => test.status !== 'passed' && test.status !== 'failed').length,
    failures: assertions.filter(test => test.status === 'failed').map(test => ({ file: test.file, title: test.title, messages: test.failureMessages })) }
}

export async function runVitestJson(root, { config, files = [], env = {}, spawnChild = spawn } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'pencil-contract-coverage-'))
  const output = join(directory, 'results.json')
  try {
    const args = ['./node_modules/vitest/vitest.mjs', 'run', ...files, '--maxWorkers=2', '--reporter=json', '--outputFile', output]
    if (config) args.push('--config', config)
    const inheritedEnv = { ...process.env }
    for (const key of ['PENCIL_PREVIOUS_MIGRATIONS_DIR', 'PENCIL_UPGRADE_FIXTURE_PATH', 'PENCIL_UPGRADE_CHECKS_JSON']) delete inheritedEnv[key]
    const result = await new Promise((resolve, reject) => {
      const child = spawnChild(process.execPath, args, { cwd: root, env: { ...inheritedEnv, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
      child.stdout.resume()
      let stderr = ''
      child.stderr.on('data', chunk => { stderr += chunk })
      child.on('error', reject)
      child.on('close', code => resolve({ code: code ?? 1, stderr }))
    })
    let report
    try { report = JSON.parse(await readFile(output, 'utf8')); vitestPassedTests(report) } catch (error) {
      throw new Error(`Vitest exited ${result.code} without valid fresh evidence: ${error.message}`)
    }
    return { ...result, report }
  } finally { await rm(directory, { recursive: true, force: true }) }
}
