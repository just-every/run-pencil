import { isAbsolute, resolve } from 'node:path'

export function playwrightPassedTests(report) {
  const root = report.config?.rootDir
  if (typeof root !== 'string' || !isAbsolute(root)) throw new Error('Browser evidence must declare an absolute test root.')
  const outcomes = new Map()
  const visit = (suite, inheritedFile) => {
    // Wrapper callsites may name contract.ts on a spec. The enclosing suite
    // identifies the authored test file; relative names use Playwright's root.
    const file = suite.file ?? inheritedFile
    for (const spec of suite.specs ?? []) {
      const result = spec.tests?.length > 0 && spec.tests.every((test) => test.results?.length > 0 && test.results.at(-1).status === 'passed')
      if (file) {
        const key = `${resolve(root, file)}\u0000${spec.title}`
        outcomes.set(key, (outcomes.get(key) ?? true) && result)
      }
    }
    for (const child of suite.suites ?? []) visit(child, file)
  }
  for (const suite of report.suites ?? []) visit(suite)
  return new Set([...outcomes].filter(([, passed]) => passed).map(([key]) => key))
}
