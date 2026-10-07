import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { validateConfiguration } from './operations-config.mjs'
export function run(args, capture = false, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { stdio: [input === undefined ? 'ignore' : 'pipe', capture ? 'pipe' : 'inherit', 'inherit'], env: process.env })
    let output = ''
    child.stdout?.on('data', chunk => { output += chunk })
    if (input !== undefined) child.stdin.end(input)
    child.once('error', reject)
    child.once('close', code => code === 0 ? resolve(output) : reject(new Error(`Operating command failed (${args.slice(0, 3).join(' ')}).`)))
  })
}
export function target(environment) {
  const { PENCIL_WORKER_NAME: worker, PENCIL_DATABASE_NAME: database, PENCIL_WRANGLER_CONFIG: config } = environment
  if (!/^[a-z][a-z0-9-]{2,62}$/.test(worker ?? '') || !/^[a-z][a-z0-9-]{2,62}$/.test(database ?? '') || !config || !/^deploy\/[a-z0-9-]+\.toml$/.test(config)) throw new Error('Set explicit PENCIL_WORKER_NAME, PENCIL_DATABASE_NAME and PENCIL_WRANGLER_CONFIG=deploy/<name>.toml.')
  return { worker, database, config }
}
export async function setupRemote() {
  validateConfiguration(process.env)
  const { worker, database, config } = target(process.env)
  const list = async () => JSON.parse(await run(['exec', 'wrangler', 'd1', 'list', '--json'], true))
  let matches = (await list()).filter(row => row.name === database)
  if (matches.length === 0) { await run(['exec', 'wrangler', 'd1', 'create', database]); matches = (await list()).filter(row => row.name === database) }
  if (matches.length !== 1 || !matches[0].uuid) throw new Error('The requested D1 identity is not unique or did not provision.')
  const text = (await readFile('deploy/wrangler.template.toml', 'utf8'))
    .replace('name = "pencil-local"', `name = ${JSON.stringify(worker)}\nworkers_dev = true`)
    .replace('main = "src/server.ts"', 'main = "../src/server.ts"')
    .replace('database_name = "pencil-local"', `database_name = ${JSON.stringify(database)}`)
    .replace('00000000-0000-0000-0000-000000000000', matches[0].uuid)
    .replace('migrations_dir = "migrations/core"', 'migrations_dir = "../migrations/core"')
  const variables = ['APP_ORIGIN', 'PENCIL_BUILD_ID', 'SEED_ADMIN_EMAIL', 'MAIL_PROVIDER', 'MAIL_FROM']
    .map(name => `${name} = ${JSON.stringify(process.env[name])}`).join('\n')
  const expected = `${text}\n[vars]\n${variables}\nSEED_SAMPLE_DATA = "false"\nPENCIL_LOCAL_DEVELOPMENT = "false"\n`
  try {
    const existing = await readFile(config, 'utf8')
    if (existing !== expected) throw new Error('Existing target configuration differs. Preserve and reconcile its owner values before setup.')
  } catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(config, expected, { flag: 'wx', mode: 0o600 }) }
  console.log(`Target configuration ready: ${config}. D1 ${database} was found or created by exact identity; deployment is a separate command.`)
}
if (process.argv[1]?.endsWith('/setup.mjs')) {
  if (process.argv.slice(2).join(' ') === '--remote') await setupRemote()
  else if (process.argv.length === 2) await run(['db:migrate:local'])
  else throw new Error('Usage: pnpm run setup [--remote]')
}
