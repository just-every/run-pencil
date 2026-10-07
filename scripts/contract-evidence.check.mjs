import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playwrightPassedTests } from './contract-evidence.mjs'

test('browser evidence resolves authored suites against the actual test root and excludes failures/skips', () => {
  const report = { config: { rootDir: '/tmp/pencil/tests/e2e' }, suites: [{ file: 'rendering.spec.ts', suites: [{ specs: [
    { file: 'contract.ts', title: '[BASE-ACCESS-002] native transport', tests: [{ results: [{ status: 'passed' }] }] },
    { title: 'failed', tests: [{ results: [{ status: 'failed' }] }] },
    { title: 'skipped', tests: [{ results: [{ status: 'skipped' }] }] },
    { title: 'never run', tests: [{ results: [] }] },
  ] }] }] }
  assert.deepEqual([...playwrightPassedTests(report)], ['/tmp/pencil/tests/e2e/rendering.spec.ts\u0000[BASE-ACCESS-002] native transport'])
  assert.throws(() => playwrightPassedTests({ suites: report.suites }), /absolute test root/)
})

test('coverage refuses a passing project beside a skipped or failed project and refuses a failed last attempt', () => {
  for (const tests of [
    [{ results: [{ status: 'passed' }] }, { results: [{ status: 'skipped' }] }],
    [{ results: [{ status: 'passed' }] }, { results: [{ status: 'failed' }] }],
    [{ results: [{ status: 'passed' }, { status: 'failed' }] }],
  ]) assert.equal(playwrightPassedTests({ config: { rootDir: '/tmp/pencil' }, suites: [{ file: 'test.ts', specs: [{ title: 'must pass everywhere', tests }] }] }).size, 0)
})

 test('a passing duplicate suite cannot hide a failed project in another suite entry', () => {
  for (const statuses of [['passed', 'failed'], ['failed', 'passed'], ['passed', 'skipped']]) {
    const suites = statuses.map(status => ({ file: 'same.spec.ts', specs: [{ title: 'same authored case', tests: [{ results: [{ status }] }] }] }))
    assert.equal(playwrightPassedTests({ config: { rootDir: '/tmp/pencil' }, suites }).size, 0)
  }
})
