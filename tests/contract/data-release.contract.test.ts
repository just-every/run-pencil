/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { contract } from '../../src/test/contract'

// The whole-data round trip runs as balanced groups of the archive checks so no
// single test nears its limit on a slow runner. Each group takes about 40 s on a
// developer Mac and up to 4x that on a busy two-core runner.
const groups = {
  stream: ['deployment-data-dev'],
  graph: ['deployment-data'],
  recovery: ['deployment-data-hosted'],
  restore: ['deployment-data-initialized'],
  delivery: ['deployment-data-custody-replay', 'deployment-data-install', 'deployment-data-notification', 'deployment-data-reporting', 'distribution-data', 'action-data', 'analysis-data'],
}

function archiveChecks(files: string[]) {
  // The child exits unsuccessfully if any real archive journey fails. Its
  // number of checks grows when retained table shapes and custody evolve.
  try {
    execFileSync('node', ['--test', '--test-concurrency=2', ...files.map(file => `scripts/${file}.check.mjs`)], { encoding: 'utf8' })
  } catch (failure) {
    const child = failure as Error & { status?: number; stdout?: string; stderr?: string }
    const output = `${child.stdout ?? ''}\n${child.stderr ?? ''}`
    const coordinates = [...new Set([...output.matchAll(/(?:file:\/\/)?(\/[\w./-]+\/(?:scripts|src)\/[\w./-]+\.(?:mjs|ts)(?::\d+(?::\d+)?)?)/g)].map(match => match[1]))]
    const codes = [...new Set(output.match(/\bERR_[A-Z_]+\b/g) ?? [])]
    // Child assertions can contain archived values. Only source coordinates
    // and its exit code leave this private diagnostic boundary.
    throw new Error(`Archive verification exited ${child.status ?? 'unsuccessfully'}; failure coordinates: ${coordinates.join(', ') || 'unavailable'}; Node codes: ${codes.join(', ') || 'none'}; diagnostic bytes: ${Buffer.byteLength(output)}`)
  }
}

contract(['DATA-001','BASE-DATA-001'], 'whole-data recovery excludes development identity and sign-in authorization', () => archiveChecks(groups.stream), 240_000)
contract(['DATA-001','BASE-DATA-001','FLOW-015'], 'whole-data archives preserve stable revisions, quarantine, receipts, effects and exact values and refuse unsafe targets', () => archiveChecks(groups.graph), 240_000)
contract(['DATA-001','BASE-DATA-001'], 'whole-data owner recovery round-trips a hosted installation and refuses altered migration ledgers', () => archiveChecks(groups.recovery), 240_000)
contract(['DATA-001','BASE-DATA-001'], 'whole-data restore replaces initialized system state exactly and refuses owner-populated targets', () => archiveChecks(groups.restore), 240_000)
contract(['DATA-001','BASE-DATA-001','ACT-007'], 'whole-data recovery preserves import custody, delivery facts, actions, analyses and reporting scope without replay', () => archiveChecks(groups.delivery), 240_000)
