/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { contract } from '../../src/test/contract'
contract(['DATA-001','BASE-DATA-001','FLOW-015','ACT-007'], 'whole-data CLI export/import/export preserves every actual table, auth mapping, delivery fact, action, analysis and stable graph and refuses unsafe archives', () => {
  // The child exits unsuccessfully if any real archive journey fails. Its
  // number of checks grows when retained table shapes and custody evolve.
  try {
    execFileSync(process.execPath,['--test','--test-concurrency=2','scripts/deployment-data.check.mjs','scripts/distribution-data.check.mjs','scripts/action-data.check.mjs','scripts/analysis-data.check.mjs'],{encoding:'utf8'})
  } catch (failure) {
    const child = failure as Error & { status?: number; stdout?: string; stderr?: string }
    const output = `${child.stdout ?? ''}\n${child.stderr ?? ''}`
    const coordinates = [...new Set([...output.matchAll(/(?:file:\/\/)?(\/[\w./-]+\/(?:scripts|src)\/[\w./-]+\.(?:mjs|ts)(?::\d+(?::\d+)?)?)/g)].map(match => match[1]))]
    const codes = [...new Set(output.match(/\bERR_[A-Z_]+\b/g) ?? [])]
    // Child assertions can contain archived values. Only source coordinates
    // and its exit code leave this private diagnostic boundary.
    throw new Error(`Archive verification exited ${child.status ?? 'unsuccessfully'}; failure coordinates: ${coordinates.join(', ') || 'unavailable'}; Node codes: ${codes.join(', ') || 'none'}; diagnostic bytes: ${Buffer.byteLength(output)}`)
  }
}, 240_000)
