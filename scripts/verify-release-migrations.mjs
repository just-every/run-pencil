import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)

function command(file, args, options = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(file, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...options })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolveResult({ code, output }))
  })
}

async function gitShow(tag, path) {
  const result = await command('git', ['show', `${tag}:${path}`])
  if (result.code !== 0) throw new Error(result.output.trim())
  return result.output
}

async function releasedMigrationFiles(tag) {
  const result = await command('git', ['ls-tree', '-r', '--name-only', tag, 'migrations/core'])
  if (result.code !== 0) throw new Error(result.output.trim())
  return result.output.split(/\r?\n/).filter((path) => /^migrations\/core\/[^/]+\.sql$/.test(path))
}

async function changedMigrationFiles(tag) {
  const result = await command('git', ['diff', '--name-only', `${tag}..HEAD`, '--', 'migrations/core'])
  if (result.code !== 0) throw new Error(result.output.trim())
  return result.output.split(/\r?\n/).filter((path) => path.startsWith('migrations/core/'))
}

function upgradeChecks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Upgrade metadata must be an object.')
  const checks = value.checks
  if (!Array.isArray(checks)) throw new Error('Upgrade metadata needs a checks array.')
  const required = new Set(['sample-row', 'graph-link', 'idempotency'])
  for (const check of checks) {
    if (!check || typeof check !== 'object' || !required.delete(check.kind) || typeof check.query !== 'string' || !check.query.trim() || !Array.isArray(check.expectedRows)) {
      throw new Error('Each upgrade check must have one of the unique kinds sample-row, graph-link, idempotency plus a SQL query and expectedRows array.')
    }
  }
  if (required.size > 0) throw new Error(`Upgrade metadata is missing required check(s): ${[...required].join(', ')}.`)
  return checks
}

let release
try {
  release = JSON.parse(await readFile(resolve(root, 'RELEASE.json'), 'utf8'))
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    const tags = await command('git', ['tag', '--merged', 'HEAD'])
    if (tags.code !== 0) throw new Error(tags.output.trim())
    const released = tags.output.split(/\r?\n/).some((tag) => /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag.trim()))
    if (!released) {
      console.log('No RELEASE.json or prior release tag is reachable: this is a first-release migration gate. The Worker D1 suite proves migration from an empty database.')
      process.exit(0)
    }
    throw new Error('A release tag is reachable but RELEASE.json is absent, so an upgrade predecessor cannot be determined.')
  }
  throw error
}

if (!release.previousVersion) {
  console.log(`RELEASE.json declares ${release.version} as the first release. The Worker D1 suite proves migration from an empty database.`)
  process.exit(0)
}
const previous = release.previousVersion
const candidates = [previous, `v${previous}`]
let previousTag
for (const candidate of candidates) {
  const found = await command('git', ['rev-parse', '--verify', `${candidate}^{commit}`])
  if (found.code === 0) {
    previousTag = candidate
    break
  }
}
if (!previousTag) throw new Error(`RELEASE.json declares previousVersion ${previous}, but neither ${previous} nor v${previous} resolves to a commit.`)
const ancestor = await command('git', ['merge-base', '--is-ancestor', previousTag, 'HEAD'])
if (ancestor.code !== 0) throw new Error(`Declared previous release tag ${previousTag} is not an ancestor of this candidate.`)
if (release.version === release.previousVersion) throw new Error('RELEASE.json version and previousVersion must differ.')
const releasedFiles = new Set(await releasedMigrationFiles(previousTag))
const rewritten = (await changedMigrationFiles(previousTag)).filter((path) => releasedFiles.has(path))
if (rewritten.length > 0) throw new Error(`Released core migrations are immutable. Candidate changes prior release file(s): ${rewritten.join(', ')}.`)

const upgradeDirectory = resolve(root, 'tests/runtime/upgrades')
const fixture = join(upgradeDirectory, `${previous}.sql`)
const metadata = join(upgradeDirectory, `${previous}.json`)
await access(fixture)
const fixtureText = await readFile(fixture, 'utf8')
if (!fixtureText.trim()) throw new Error(`Upgrade fixture ${fixture} is empty.`)
const checks = upgradeChecks(JSON.parse(await readFile(metadata, 'utf8')))

const temporary = await mkdtemp(join(tmpdir(), 'pencil-previous-migrations-'))
try {
  for (const path of releasedFiles) {
    const destination = join(temporary, path.replace('migrations/core/', ''))
    await mkdir(resolve(destination, '..'), { recursive: true })
    await writeFile(destination, await gitShow(previousTag, path))
  }
  const result = await command('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.worker.config.ts', 'tests/runtime/upgrades.worker.test.ts'], {
    env: {
      ...process.env,
      PENCIL_PREVIOUS_MIGRATIONS_DIR: temporary,
      PENCIL_UPGRADE_FIXTURE_PATH: fixture,
      PENCIL_UPGRADE_CHECKS_JSON: JSON.stringify(checks),
    },
  })
  if (result.code !== 0) throw new Error(`Workers D1 upgrade test from ${previousTag} failed:\n${result.output.trim()}`)
  console.log(`Workers D1 upgrade migration from ${previousTag} passed with fixture ${fixture}.`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
