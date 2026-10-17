import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { playwrightPassedTests } from './contract-evidence.mjs'

export async function runPlaywrightJson(root, { project, shard } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'pencil-browser-contract-coverage-'))
  const output = join(directory, 'results.json')
  try {
    const result = await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, ['scripts/run-browser-checks.mjs', output, ...(project ? [project, String(shard)] : [])], {
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
    if (result.code !== 0 && !report.suites?.length) {
      // Report startup stages and exit codes, never captured request data or credentials.
      const stages = [...new Set(result.stderr.match(/Pencil browser setup: (?:site build|app build|app migrations) exited \d+/g) ?? [])]
      for (const stage of stages) console.error(stage)
      console.error(`Browser setup failed before test cases (${report.errors?.length ?? 0} runner errors, exit ${result.code}).`)
    }
    const failures = suites => {
      for (const suite of suites ?? []) {
        for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
          if (test.status !== 'unexpected') continue
          for (const [attempt,result] of test.results.entries()) {
            if (result.status === 'passed') continue
            const coordinates = [...(result.error?.stack ?? '').matchAll(/([^\s()]+\/tests\/[^:\s]+):(\d+):(\d+)/g)]
              .map(match => `${match[1]}:${match[2]}:${match[3]}`)
            const location = result.error?.location
            if (location) coordinates.unshift(`${location.file}:${location.line}:${location.column}`)
            // Only authored titles and source coordinates leave the private report.
            console.error(`Browser failure: ${spec.title} at ${[...new Set(coordinates)].join(', ') || `${spec.file}:${spec.line}:${spec.column}`} (${test.projectName}, attempt ${attempt + 1}, ${result.status})`)
          }
        }
        failures(suite.suites)
      }
    }
    failures(report.suites)
    return { ...result, report, passed: playwrightPassedTests(report) }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
