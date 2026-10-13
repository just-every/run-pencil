import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { access, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { runVitestJson, vitestPassedTests, vitestRunSummary } from './vitest-evidence.mjs'

const report = (status = 'passed', file = '/source/upgrade.test.ts', title = '[BASE-OPS-002] native upgrade') => ({ testResults: [{ name: file, assertionResults: [{ title, status }] }] })

test('BASE-OPS-002 only matching passed assertions provide evidence; skips, failures and duplicate contradictions do not', () => {
  const expected = '/source/upgrade.test.ts\u0000[BASE-OPS-002] native upgrade'
  assert.ok(vitestPassedTests(report()).has(expected))
  for (const status of ['pending', 'skipped', 'failed', 'todo']) assert.equal(vitestPassedTests(report(status)).size, 0)
  assert.equal(vitestPassedTests({ testResults: [] }).size, 0)
  assert.equal(vitestPassedTests(report('passed', '/other.test.ts')).has(expected), false)
  assert.equal(vitestPassedTests(report('passed', undefined, 'other title')).has(expected), false)
  assert.equal(vitestPassedTests({ testResults: [...report().testResults, ...report('failed').testResults] }).size, 0)
  assert.deepEqual(vitestRunSummary({ code: 7, report: { testResults: [...report().testResults, ...report('failed', undefined, 'failure').testResults, ...report('pending', undefined, 'pending').testResults, ...report().testResults] } }), {
    code: 7, passed: 1, failed: 1, pending: 1, failures: [{ file: '/source/upgrade.test.ts', title: 'failure', messages: undefined }],
  })
})

test('BASE-OPS-002 ordinary runtime cannot inherit stale external upgrade inputs', async () => {
  const keys = ['PENCIL_PREVIOUS_MIGRATIONS_DIR', 'PENCIL_UPGRADE_FIXTURE_PATH', 'PENCIL_UPGRADE_CHECKS_JSON']
  const saved = keys.map(key => process.env[key])
  try {
    for (const key of keys) process.env[key] = 'stale-external-input'
    await assert.rejects(runVitestJson(process.cwd(), { spawnChild: (_file, _args, options) => {
      for (const key of keys) assert.equal(options.env[key], undefined)
      throw new Error('Probe stops before runtime')
    } }), /Probe stops before runtime/)
  } finally {
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index] })
  }
})

test('BASE-OPS-002 fresh child evidence shares inputs, propagates exit status and cleans success, missing report and spawn failure', async () => {
  let previousOutput
  for (const mode of ['passed', 'failed', 'missing', 'spawn-error', 'malformed']) {
    let output
    const spawnChild = (_file, args, options) => {
      output = args[args.indexOf('--outputFile') + 1]
      assert.notEqual(output, previousOutput)
      previousOutput = output
      assert.equal(options.env.PENCIL_PREVIOUS_MIGRATIONS_DIR, 'current-invocation')
      assert.equal(options.env.PENCIL_UPGRADE_FIXTURE_PATH, 'current-fixture')
      assert.equal(options.env.PENCIL_UPGRADE_CHECKS_JSON, 'current-checks')
      const child = new EventEmitter()
      child.stdout = new PassThrough()
      child.stderr = new PassThrough()
      setImmediate(async () => {
        if (mode === 'spawn-error') { child.emit('error', new Error('spawn failed')); return }
        if (mode !== 'missing') await writeFile(output, mode === 'malformed' ? '{' : JSON.stringify(report(mode === 'failed' ? 'failed' : 'passed')))
        child.emit('close', mode === 'failed' ? 7 : 0)
      })
      return child
    }
    const result = runVitestJson(process.cwd(), { spawnChild, env: { PENCIL_PREVIOUS_MIGRATIONS_DIR: 'current-invocation', PENCIL_UPGRADE_FIXTURE_PATH: 'current-fixture', PENCIL_UPGRADE_CHECKS_JSON: 'current-checks' } })
    if (['missing', 'spawn-error', 'malformed'].includes(mode)) await assert.rejects(result)
    else assert.equal((await result).code, mode === 'failed' ? 7 : 0)
    await assert.rejects(access(dirname(output)), { code: 'ENOENT' })
  }
})
