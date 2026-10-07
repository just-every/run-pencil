import { access, readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'

const template = new URL('../deploy/wrangler.template.toml', import.meta.url)
const generated = new URL('../wrangler.toml', import.meta.url)

try {
  await access(generated, constants.F_OK)
} catch {
  const productionTemplate = await readFile(template, 'utf8')
  const localVariables = `

# Generated for Miniflare by pnpm dev/build. Production setup starts from
# deploy/wrangler.template.toml and must provide real deployment values.
[vars]
SEED_SAMPLE_DATA = "true"
MAIL_PROVIDER = "local"
PENCIL_LOCAL_DEVELOPMENT = "true"
`
  await writeFile(generated, `${productionTemplate.trimEnd()}${localVariables}`)
}

// Explicit generated loopback secret; never a compiled or production fallback.
const configured = await readFile(generated, 'utf8')
if (/MAIL_PROVIDER\s*=\s*"local"/.test(configured) && !/SESSION_SECRET\s*=/.test(configured)) {
  await writeFile(generated, `${configured.trimEnd()}\nSESSION_SECRET = "${randomBytes(32).toString('hex')}"\n`)
}
