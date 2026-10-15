import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

function command(root, file, args, options = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(file, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...options })
    const chunks = []
    let output = ''
    child.stdout.on('data', (chunk) => { chunks.push(chunk); output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (code) => resolveResult({ code, output, bytes: Buffer.concat(chunks) }))
  })
}

async function gitShow(repository, tag, path) {
  const result = await command(repository, 'git', ['show', `${tag}:${path}`])
  if (result.code !== 0) throw new Error(result.output.trim())
  return result.bytes
}

async function releasedMigrationFiles(repository, tag) {
  const result = await command(repository, 'git', ['ls-tree', '-r', '--name-only', tag, 'migrations/core'])
  if (result.code !== 0) throw new Error(result.output.trim())
  return result.output.split(/\r?\n/).filter((path) => /^migrations\/core\/[^/]+\.sql$/.test(path))
}

const noPrompt = { ...process.env, GIT_TERMINAL_PROMPT: '0' }

// A copy without the release tag (a depth-1, tagless checkout such as RER's Managed copy) shares no
// history with the release, so the published tag is fetched by exact name from rer-project.json's
// sourceRepository into a throwaway repository and only its migration bytes are compared.
async function publishedRelease(root, candidates) {
  let source
  try { source = JSON.parse(await readFile(resolve(root, 'rer-project.json'), 'utf8')).sourceRepository } catch { source = undefined }
  if (typeof source !== 'string' || !source.trim()) return undefined
  const listed = await command(root, 'git', ['ls-remote', '--tags', source, ...candidates.map((candidate) => `refs/tags/${candidate}`)], { env: noPrompt })
  if (listed.code !== 0) throw new Error(`Cannot list release tags at ${source}: ${listed.output.trim()}`)
  const names = new Set(listed.output.split(/\r?\n/).map((line) => line.split('\t')[1]).filter(Boolean))
  const candidate = candidates.find((name) => names.has(`refs/tags/${name}`))
  if (!candidate) return undefined
  const repository = await mkdtemp(join(tmpdir(), 'pencil-published-release-'))
  const ref = `refs/tags/${candidate}`
  try {
    const init = await command(repository, 'git', ['init', '-q', '--bare'])
    if (init.code !== 0) throw new Error(init.output.trim())
    const fetched = await command(repository, 'git', ['fetch', '-q', '--depth=1', '--no-tags', source, `+${ref}:${ref}`], { env: noPrompt })
    if (fetched.code !== 0) throw new Error(`Cannot fetch ${ref} from ${source}: ${fetched.output.trim()}`)
  } catch (error) {
    await rm(repository, { recursive: true, force: true })
    throw error
  }
  return { repository, ref, label: `${source} ${ref}` }
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

// migrations/released-rewrites.json names each released migration whose bytes changed, with both
// exact hashes and the later migration that brings a database holding the released text to the same schema.
async function releasedRewrites(root) {
  let text
  try { text = await readFile(resolve(root, 'migrations/released-rewrites.json'), 'utf8') } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
  const value = JSON.parse(text)
  if (!Array.isArray(value)) throw new Error('migrations/released-rewrites.json must be an array.')
  return value
}

async function declaredRewrite(root, rewrites, path, released, current, releasedFiles) {
  const id = path.replace('migrations/core/', '')
  const entry = rewrites.find((rewrite) => rewrite?.id === id)
  if (!entry || entry.releasedSha256 !== sha256(released) || entry.sha256 !== sha256(current) || typeof entry.reason !== 'string' || !entry.reason.trim()) return false
  const converging = `migrations/core/${entry.convergedBy}`
  if (typeof entry.convergedBy !== 'string' || releasedFiles.has(converging) || converging <= path) return false
  try { await readFile(resolve(root, converging)) } catch { return false }
  return true
}

function upgradeChecks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Upgrade metadata must be an object.')
  const checks = value.checks
  if (!Array.isArray(checks)) throw new Error('Upgrade metadata needs a checks array.')
  const required = new Set(['sample-row', 'graph-link', 'idempotency'])
  for (const check of checks) {
    if (!check || typeof check !== 'object' || !required.delete(check.kind) || typeof check.query !== 'string' || !check.query.trim() || !Array.isArray(check.expectedRows) || check.expectedRows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || !Object.keys(row).length)) {
      throw new Error('Each upgrade check must have one of the unique kinds sample-row, graph-link, idempotency plus a SQL query and expectedRows array.')
    }
  }
  if (required.size > 0) throw new Error(`Upgrade metadata is missing required check(s): ${[...required].join(', ')}.`)
  return checks
}

// Fresh inputs belong to this invocation and are removed even if the child fails.
export async function withReleaseUpgradeInputs(root, run) {
  let release
  try {
    release = JSON.parse(await readFile(resolve(root, 'RELEASE.json'), 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      const tags = await command(root, 'git', ['tag', '--merged', 'HEAD'])
      if (tags.code !== 0) throw new Error(tags.output.trim())
      const released = tags.output.split(/\r?\n/).some((tag) => /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag.trim()))
      if (!released) {
        console.log('No RELEASE.json or prior release tag is reachable: this is a first-release migration gate. The Worker D1 suite proves migration from an empty database.')
        return run({ env: {}, firstRelease: true })
      }
      throw new Error('A release tag is reachable but RELEASE.json is absent, so an upgrade predecessor cannot be determined.')
    }
    throw error
  }

  const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
  if (!release || typeof release !== 'object' || typeof release.version !== 'string' || !versionPattern.test(release.version)) throw new Error('RELEASE.json needs a valid version.')
  if (release.previousVersion === undefined || release.previousVersion === null) {
    console.log(`RELEASE.json declares ${release.version} as the first release. The Worker D1 suite proves migration from an empty database.`)
    return run({ env: {}, firstRelease: true })
  }
  const previous = release.previousVersion
  if (typeof previous !== 'string' || !versionPattern.test(previous)) throw new Error('RELEASE.json needs a valid previousVersion.')
  if (release.version === previous) throw new Error('RELEASE.json version and previousVersion must differ.')
  const candidates = [previous, `v${previous}`]
  let previousTag
  for (const candidate of candidates) {
    const found = await command(root, 'git', ['rev-parse', '--verify', `refs/tags/${candidate}^{commit}`])
    if (found.code === 0) {
      previousTag = `refs/tags/${candidate}`
      break
    }
  }
  let predecessor = { repository: root, ref: previousTag, label: previousTag }
  if (previousTag) {
    const ancestor = await command(root, 'git', ['merge-base', '--is-ancestor', previousTag, 'HEAD'])
    if (ancestor.code !== 0) throw new Error(`Declared previous release tag ${previousTag} is not an ancestor of this candidate.`)
  } else {
    const published = await publishedRelease(root, candidates)
    if (!published) throw new Error(`RELEASE.json declares previousVersion ${previous}, but neither ${previous} nor v${previous} resolves to a commit here or at rer-project.json's sourceRepository.`)
    console.log(`No local ${previous} release tag: comparing released migrations with ${published.label}.`)
    predecessor = published
  }
  try {
    return await upgradeFrom(root, previous, predecessor, run)
  } finally {
    if (predecessor.repository !== root) await rm(predecessor.repository, { recursive: true, force: true })
  }
}

async function upgradeFrom(root, previous, release, run) {
  const releasedFiles = new Set(await releasedMigrationFiles(release.repository, release.ref))
  const rewrites = await releasedRewrites(root)
  const migrations = []
  for (const path of releasedFiles) {
    const bytes = await gitShow(release.repository, release.ref, path)
    let current
    try { current = await readFile(resolve(root, path)) } catch { throw new Error(`Released core migrations are immutable: ${path} is absent.`) }
    if (!current.equals(bytes) && !await declaredRewrite(root, rewrites, path, bytes, current, releasedFiles)) throw new Error(`Released core migrations are immutable: ${path} changed.`)
    // The predecessor applies the bytes it released; a declared rewrite is proven by upgrading from them.
    migrations.push({ path, bytes })
  }
  if (!migrations.length) throw new Error('The previous release has no core migrations.')

  const upgradeDirectory = resolve(root, 'tests/runtime/upgrades')
  const fixture = join(upgradeDirectory, `${previous}.sql`)
  const metadata = join(upgradeDirectory, `${previous}.json`)
  const fixtureText = await readFile(fixture, 'utf8')
  const populatedSql = fixtureText.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '').trim()
  if (!populatedSql || !/\bINSERT\s+INTO\b/i.test(populatedSql)) throw new Error(`Upgrade fixture ${fixture} is empty.`)
  const checks = upgradeChecks(JSON.parse(await readFile(metadata, 'utf8')))

  const temporary = await mkdtemp(join(tmpdir(), 'pencil-previous-migrations-'))
  try {
    for (const { path, bytes } of migrations) {
      const destination = join(temporary, path.replace('migrations/core/', ''))
      await mkdir(resolve(destination, '..'), { recursive: true })
      await writeFile(destination, bytes)
    }
    const fixturePath = join(temporary, 'fixture.sql.input')
    await writeFile(fixturePath, fixtureText)
    return await run({ tag: release.label, migrationCount: migrations.length, env: {
      PENCIL_PREVIOUS_MIGRATIONS_DIR: temporary,
      PENCIL_UPGRADE_FIXTURE_PATH: fixturePath,
      PENCIL_UPGRADE_CHECKS_JSON: JSON.stringify(checks),
    } })
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }

}
