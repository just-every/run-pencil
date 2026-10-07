import { rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const port = process.argv[2]
if (!/^[0-9]+$/.test(port ?? '')) throw new Error('Pass the e2e server port as the only argument.')
const state = resolve(root, '.pencil-e2e-state')

let activeChild
let receivedSignal

function run(file, args, environment) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(file, args, { cwd: root, detached: false, env: environment, stdio: 'inherit' })
    activeChild = child
    child.on('error', reject)
    child.on('close', (code) => {
      if (activeChild === child) activeChild = undefined
      resolveResult(code ?? 1)
    })
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    receivedSignal = signal
    if (!activeChild) return
    try {
      activeChild.kill(signal)
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  })
}

async function cleanState() {
  await rm(state, { recursive: true, force: true })
}

await cleanState()
const common = { ...process.env, PENCIL_WRANGLER_CONFIG: 'wrangler.toml', CI: '1', WRANGLER_SEND_METRICS: 'false', XDG_CONFIG_HOME: resolve(root, '.isolated-config') }
const built = await run('pnpm', ['build'], common)
if (built !== 0) process.exit(built)
const migrated = await run('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'pencil-local', '--local', '--persist-to', state, '--config', 'wrangler.toml'], common)
if (migrated !== 0) {
  await cleanState()
  process.exit(migrated)
}

const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js')
const exitCode = await run(process.execPath, [wrangler, 'dev', '--local', '--config', 'dist/server/wrangler.json', '--ip', '127.0.0.1', '--port', port, '--inspector-port', '0', '--persist-to', state], common)
await cleanState()
process.exit(receivedSignal ? 0 : exitCode)
