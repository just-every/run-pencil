import { rm, mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { managementEdge } from '../tests/admission/management-edge.mjs'
import { testDevKey } from '../tests/helpers/dev-key.mjs'

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
await mkdir(state, { recursive: true })
// The native suite owns explicit synthetic sample state and credentials. It
// never relies on, replaces or reads the owner's local setup file.
const config = resolve(state, 'wrangler.toml')
const template = (await readFile(resolve(root, 'deploy/wrangler.template.toml'), 'utf8'))
  .replace('main = "src/server.ts"', 'main = "../tests/helpers/mail-browser-worker.ts"')
  .replace('migrations_dir = "migrations/core"', 'migrations_dir = "../migrations/core"')
  .replace('MAIL_PROVIDER = "resend"', 'MAIL_PROVIDER = "local"')
const managementVars = process.argv[3] === '--management' ? `\nRER_MANAGEMENT_ORIGIN = "http://127.0.0.1:${Number(port) + 1}"\nRER_INSTALLATION_ID = "synthetic-pencil-admission"\n` : ''
// The actions journey starts its own loopback task receiver on this port (tests/e2e/task-receiver.ts).
const taskPort = process.env.PENCIL_E2E_TASK_PORT ?? String(Number(port) + 2)
const taskVars = `TASK_PROVIDER = "webhook"\nTASK_WEBHOOK_URL = "http://127.0.0.1:${taskPort}/tasks"\n`
// The analysis journey starts its own loopback OpenAI-compatible provider on this port (tests/e2e/ai-receiver.ts).
const aiPort = process.env.PENCIL_E2E_AI_PORT ?? String(Number(port) + 3)
const aiVars = `AI_ENABLED = "true"\nAI_MODEL = "synthetic-browser-model"\nAI_BASE_URL = "http://127.0.0.1:${aiPort}/v1"\n`
// The payment journey starts its own loopback Stripe stand-in on this port (tests/e2e/stripe-receiver.ts).
const stripePort = process.env.PENCIL_E2E_STRIPE_PORT ?? String(Number(port) + 4)
const stripeVars = `STRIPE_API_ORIGIN = "http://127.0.0.1:${stripePort}"\n`
await writeFile(config, template + '\nPENCIL_LOCAL_DEVELOPMENT = "true"\nSEED_SAMPLE_DATA = "true"\n' + taskVars + aiVars + stripeVars + managementVars)
await writeFile(resolve(state, '.dev.vars'), `SESSION_SECRET=synthetic-native-browser-session-secret-at-least-32-characters\nRER_DEV_KEY=${testDevKey}\nTASK_API_KEY=synthetic-browser-task-key\nAI_API_KEY=synthetic-browser-ai-key\n`, { mode: 0o600 })
const common = { ...process.env, PENCIL_WRANGLER_CONFIG: config, CI: '1', WRANGLER_SEND_METRICS: 'false', XDG_CONFIG_HOME: resolve(root, '.isolated-config') }
let management
let exitCode
try {
  const built = await run('pnpm', ['exec', 'vite', 'build', '--config', 'tests/helpers/vite-mail.config.ts'], common)
  if (built !== 0) console.error(`Pencil browser setup: app build exited ${built}`)
  if (receivedSignal) exitCode = 0
  else if (built !== 0) exitCode = built
  else {
    const migrated = await run('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'pencil-local', '--local', '--persist-to', state, '--config', config], common)
    if (migrated !== 0) console.error(`Pencil browser setup: app migrations exited ${migrated}`)
    if (receivedSignal) exitCode = 0
    else if (migrated !== 0) exitCode = migrated
    else {
      if (process.argv[3] === '--management') {
        management = await managementEdge(Number(port) + 1)
        management.state.allowed = `http://127.0.0.1:${port}`
      }
      const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js')
      exitCode = receivedSignal ? 0 : await run(process.execPath, [wrangler, 'dev', '--local', '--config', 'dist/server/wrangler.json', '--ip', '127.0.0.1', '--port', port, '--inspector-port', '0', '--persist-to', state], common)
    }
  }
} finally { await management?.close(); await cleanState() }
process.exit(receivedSignal ? 0 : exitCode)
