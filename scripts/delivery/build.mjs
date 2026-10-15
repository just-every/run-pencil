import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { execFileSync, spawn } from 'node:child_process'
import { resolve, join } from 'node:path'

const root = resolve(new URL('../..', import.meta.url).pathname)
// Managed uploads bind the release digest and Worker version; the immutable
// source commit must travel with the Worker built from this checkout.
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Managed build requires a source commit.')
const directory = await mkdtemp(join(root, '.pencil-delivery-build-'))
try {
  const template = (await readFile(join(root, 'deploy/wrangler.template.toml'), 'utf8'))
    .replace('main = "src/server.ts"', 'main = "../src/server.ts"')
    .replace('migrations_dir = "migrations/core"', 'migrations_dir = "../migrations/core"')
  const config = join(directory, 'wrangler.toml')
  await writeFile(config, template, { flag: 'wx' })
  const child = spawn('pnpm', ['run', 'build:app'], { cwd: root, env: { ...process.env, PENCIL_WRANGLER_CONFIG: config, PENCIL_MANAGED_SOURCE_SHA: sourceSha }, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal))
  process.exitCode = await new Promise((resolveCode, reject) => {
    child.once('error', reject)
    child.once('close', code => resolveCode(code ?? 1))
  })
} finally { await rm(directory, { recursive: true, force: true }) }
