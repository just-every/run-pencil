// Share build output only within this exact Actions run and commit, across its attempts: a rerun of failed jobs reuses the run's build.
// Runtime state, migrations, sessions and rate ledgers are always created afresh.
import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const profiles = { production: ['client', 'server'], browser: ['client', 'server'], admission: ['client', 'server'], site: ['site'] }
function identity(root, profile) {
  if (!Object.hasOwn(profiles, profile)) throw new Error('Unknown CI build profile.')
  const { GITHUB_RUN_ID: run } = process.env
  if (!run) throw new Error('Shared CI builds require a run.')
  return { run, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), profile }
}
function directory(profile) {
  if (!process.env.PENCIL_CI_BUILDS) throw new Error('Set PENCIL_CI_BUILDS for shared build output.')
  return resolve(process.env.PENCIL_CI_BUILDS, profile)
}
export async function saveCiBuild(root, profile) {
  const metadata = identity(root, profile), destination = directory(profile)
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  for (const part of profiles[profile]) await cp(resolve(root, 'dist', part), resolve(destination, part), { recursive: true })
  await writeFile(resolve(destination, 'identity.json'), JSON.stringify(metadata) + '\n')
}
export async function restoreCiBuild(root, profile) {
  if (!process.env.PENCIL_CI_BUILDS) return false
  const expected = identity(root, profile), source = directory(profile)
  const actual = JSON.parse(await readFile(resolve(source, 'identity.json'), 'utf8'))
  if (Object.entries(expected).some(([key, value]) => actual[key] !== value)) throw new Error('Missing or stale CI build identity.')
  // Validate every required part before replacing any output. Never fall back to
  // rebuilding a missing or stale artifact: that would conceal broken wiring.
  for (const part of profiles[profile]) await stat(resolve(source, part))
  for (const part of profiles[profile]) {
    await rm(resolve(root, 'dist', part), { recursive: true, force: true })
    await cp(resolve(source, part), resolve(root, 'dist', part), { recursive: true })
  }
  if (profile !== 'site') {
    await mkdir(resolve(root, '.wrangler/deploy'), { recursive: true })
    await writeFile(resolve(root, '.wrangler/deploy/config.json'), JSON.stringify({ configPath: '../../dist/server/wrangler.json', auxiliaryWorkers: [] }))
  }
  return true
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [operation, profile] = process.argv.slice(2)
  if (operation === 'save') await saveCiBuild(process.cwd(), profile)
  else if (operation === 'restore') {
    if (!await restoreCiBuild(process.cwd(), profile)) throw new Error('Shared CI build directory is required.')
  } else throw new Error('Use ci-builds.mjs save|restore production|browser|admission|site.')
}
