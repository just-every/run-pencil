import { readFile } from 'node:fs/promises'
import { validateConfiguration } from './operations-config.mjs'
import { run, target } from './setup.mjs'
validateConfiguration(process.env)
const { worker, database, config } = target(process.env)
const text = await readFile(config, 'utf8')
if (!text.includes(`name = ${JSON.stringify(worker)}`) || !text.includes(`database_name = ${JSON.stringify(database)}`) || /00000000-0000-0000-0000-000000000000|PENCIL_LOCAL_DEVELOPMENT\s*=\s*"true"|MAIL_PROVIDER\s*=\s*"local"/.test(text)) throw new Error('Target configuration must match the explicit worker/database and production sender.')
delete process.env.PENCIL_WRANGLER_CONFIG
try { await run(['run', 'verify']) } finally { process.env.PENCIL_WRANGLER_CONFIG = config }
await run(['run', 'build'])
await run(['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote', '--config', config])
const secrets = Object.fromEntries(['MAIL_API_KEY', 'SESSION_SECRET', 'SETUP_TOKEN'].filter(name => process.env[name]).map(name => [name, process.env[name]]))
await run(['exec', 'wrangler', 'secret', 'bulk', '--config', 'dist/server/wrangler.json'], false, JSON.stringify(secrets))
await run(['exec', 'wrangler', 'deploy', '--config', 'dist/server/wrangler.json'])
