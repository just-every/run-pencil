/// <reference types="node" />
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { contract } from '../../src/test/contract'

// Verify gives each archive group its own runtime job. Keep the same registered
// proofs and public-door assertions, with no skipped tests in any group.
const execute = promisify(execFile)
const groups = {
  stream: ['deployment-data-dev'],
  graph: ['deployment-data'],
  recovery: ['deployment-data-hosted'],
  restore: ['deployment-data-initialized'],
  delivery: ['deployment-data-custody-replay', 'deployment-data-install', 'deployment-data-notification', 'deployment-data-reporting', 'distribution-data', 'action-data', 'analysis-data'],
}

const selectedGroup = process.env.PENCIL_ARCHIVE_GROUP
if (selectedGroup !== undefined && !Object.hasOwn(groups, selectedGroup)) throw new Error('Unknown archive verification group.')

async function archiveChecks(group: keyof typeof groups) {
  const files = groups[group]
  const started = performance.now()
  console.log(`Archive group ${group}: started.`)
  // The child exits unsuccessfully if any real archive journey fails. Its
  // number of checks grows when retained table shapes and custody evolve.
  try {
    await execute('node', ['--test', '--test-concurrency=2', ...files.map(file => `scripts/${file}.check.mjs`)], { encoding: 'utf8', timeout: 240_000 })
  } catch (failure) {
    const child = failure as Error & { code?: number | string; killed?: boolean; stdout?: string; stderr?: string }
    const output = `${child.stdout ?? ''}\n${child.stderr ?? ''}`
    const coordinates = [...new Set([...output.matchAll(/(?:file:\/\/)?(\/[\w./-]+\/(?:scripts|src)\/[\w./-]+\.(?:mjs|ts)(?::\d+(?::\d+)?)?)/g)].map(match => match[1]))]
    const codes = [...new Set(output.match(/\bERR_[A-Z_]+\b/g) ?? [])]
    // Child assertions can contain archived values. Only source coordinates
    // and its exit code leave this private diagnostic boundary.
    throw new Error(`Archive group ${group} exited ${child.code ?? 'unsuccessfully'}${child.killed ? ' (child deadline reached or terminated)' : ''}; failure coordinates: ${coordinates.join(', ') || 'unavailable'}; Node codes: ${codes.join(', ') || 'none'}; diagnostic bytes: ${Buffer.byteLength(output)}`)
  } finally {
    console.log(`Archive group ${group}: finished in ${((performance.now() - started) / 1000).toFixed(3)} s.`)
  }
}

if (selectedGroup === undefined || selectedGroup === 'stream') contract(['DATA-001','BASE-DATA-001'], 'whole-data recovery excludes development identity and sign-in authorization', () => archiveChecks('stream'), 240_000)
if (selectedGroup === undefined || selectedGroup === 'graph') contract(['DATA-001','BASE-DATA-001','FLOW-015'], 'whole-data archives preserve stable revisions, quarantine, receipts, effects and exact values and refuse unsafe targets', () => archiveChecks('graph'), 240_000)
if (selectedGroup === undefined || selectedGroup === 'recovery') contract(['DATA-001','BASE-DATA-001'], 'whole-data owner recovery round-trips a hosted installation and refuses altered migration ledgers', () => archiveChecks('recovery'), 240_000)
if (selectedGroup === undefined || selectedGroup === 'restore') contract(['DATA-001','BASE-DATA-001'], 'whole-data restore replaces initialized system state exactly and refuses owner-populated targets', () => archiveChecks('restore'), 240_000)
if (selectedGroup === undefined || selectedGroup === 'delivery') contract(['DATA-001','BASE-DATA-001','ACT-007'], 'whole-data recovery preserves import custody, delivery facts, actions, analyses and reporting scope without replay', () => archiveChecks('delivery'), 240_000)
