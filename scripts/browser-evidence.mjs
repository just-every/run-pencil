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
    const failures = suites => {
      for (const suite of suites ?? []) {
        for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
          if (test.status !== 'unexpected') continue
          const result = test.results.at(-1)
          const location = result?.error?.location
          const trace = result?.error?.stack?.match(/([^\s()]+\/tests\/[^:\s]+):(\d+):(\d+)/)
          // Print source coordinates only. Assertion values and browser traces
          // can contain transient credentials and stay in the private report.
          console.error(`Browser failure: ${spec.title} at ${location?.file ?? trace?.[1] ?? spec.file}:${location?.line ?? trace?.[2] ?? spec.line}:${location?.column ?? trace?.[3] ?? spec.column} (${test.projectName}, ${result?.status})`)
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
