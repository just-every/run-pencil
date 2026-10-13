import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { inspectSource } from '@runeditrun/rer/modules/release/source'
import { cleanHistory } from '@runeditrun/rer/modules/release/export'
import { publicationScan, validatePublicationDestination } from '@runeditrun/rer/modules/release/publication-scan'

// Inspect the same byte-exact parentless source used by the maintained release
// producer, without installing, verifying scale, tagging or publishing it.
const source = inspectSource(resolve(import.meta.dirname, '..'), 'HEAD')
const project = 'just-every/pencil', repository = 'https://github.com/just-every/run-pencil'
validatePublicationDestination(source, project, repository)
const temporary = mkdtempSync(resolve(tmpdir(), 'pencil-publication-'))
try {
  const exported = cleanHistory(source, temporary)
  const report = publicationScan(exported.repo, exported.commit, undefined, project, repository)
  if (process.env.PENCIL_PUBLICATION_REPORT) writeFileSync(process.env.PENCIL_PUBLICATION_REPORT, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
  console.log(JSON.stringify({ status: report.status, complete: report.complete, findings: report.findings.length, reviewed: report.reviewed.length }))
  if (report.status !== 'PASS' || report.complete !== true || report.findings.length || report.reviewed.length) process.exitCode = 1
} finally { rmSync(temporary, { recursive: true, force: true }) }
