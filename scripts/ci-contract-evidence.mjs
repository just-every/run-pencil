import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { playwrightPassedTests } from './contract-evidence.mjs'

export const contractLanes = ['unit', 'worker', 'desktop-1', 'desktop-2', 'mobile-1', 'mobile-2']

function identity(root) {
  const { GITHUB_RUN_ID: run, GITHUB_RUN_ATTEMPT: attempt } = process.env
  if (!run || !attempt) throw new Error('Sharded contract evidence requires the current GitHub run and attempt.')
  return { run, attempt, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() }
}

function containedFile(root, file) {
  const name = relative(root, resolve(root, file))
  if (!name || isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw new Error('Contract evidence names a file outside this checkout.')
  return name
}

function browserSuites(root, report) {
  const visit = (suite, inheritedFile) => {
    const file = suite.file ?? inheritedFile
    return {
      ...(file ? { file: containedFile(root, resolve(report.config.rootDir, file)) } : {}),
      specs: (suite.specs ?? []).map(spec => ({ title: spec.title, tests: (spec.tests ?? []).map(test => ({
        projectName: test.projectName, status: test.status, results: (test.results ?? []).map(result => ({ status: result.status })),
      })) })),
      suites: (suite.suites ?? []).map(child => visit(child, file)),
    }
  }
  return (report.suites ?? []).map(suite => visit(suite))
}

// Upload authored test identities and actual outcomes only. Browser traces,
// assertion values, stdout and credentials stay in the disposable runner.
export async function writeCiContractEvidence(root, directory, lane, run) {
  if (!contractLanes.includes(lane)) throw new Error(`Unknown contract lane: ${lane}`)
  const report = ['unit', 'worker'].includes(lane) ? {
    testResults: run.report.testResults.map(file => ({
      name: containedFile(root, file.name),
      assertionResults: (file.assertionResults ?? []).map(test => ({ title: test.title, status: test.status })),
    })),
  } : {
    suites: browserSuites(root, run.report),
    stats: Object.fromEntries(['startTime', 'duration', 'expected', 'skipped', 'unexpected', 'flaky'].map(key => [key, run.report.stats[key]])),
  }
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, `${lane}.json`), JSON.stringify({ ...identity(root), lane, code: run.code, report }) + '\n')
}

export async function readCiContractEvidence(root, directory) {
  const expected = identity(root)
  const runs = await Promise.all(contractLanes.map(async lane => {
    const run = JSON.parse(await readFile(join(directory, `${lane}.json`), 'utf8'))
    if (run.lane !== lane || Object.entries(expected).some(([key, value]) => run[key] !== value) || run.code !== 0) {
      throw new Error(`Missing, failed or stale contract evidence for ${lane}.`)
    }
    return run
  }))
  const runtime = runs.slice(0, 2).map(run => ({ code: run.code, report: {
    ...run.report, testResults: run.report.testResults.map(file => ({ ...file, name: resolve(root, containedFile(root, file.name)) })),
  } }))
  const browsers = runs.slice(2)
  const report = {
    config: { rootDir: root }, suites: browsers.flatMap(run => run.report.suites),
    stats: { startTime: browsers[0].report.stats.startTime,
      ...Object.fromEntries(['duration', 'expected', 'skipped', 'unexpected', 'flaky'].map(key => [key, browsers.reduce((sum, run) => sum + run.report.stats[key], 0)])),
    },
  }
  return { runtime, browserRuntime: { code: 0, report, passed: playwrightPassedTests(report) } }
}
