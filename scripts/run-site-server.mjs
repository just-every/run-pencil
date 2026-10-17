// The run site for the browser journeys of SITE-001 and SITE-002: `rer build --site` writes dist/site, then rer's own
// run site preview (what `rer dev` prints as RER_SITE) serves it as Cloudflare's static assets do.
import { execFileSync } from 'node:child_process'
import { sitePreview } from '@runeditrun/rer/internal/cli/site-preview.mjs'

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1) throw new Error('Pass the run site port as the only argument.')
try {
  execFileSync('pnpm', ['exec', 'rer', 'build', '--site', '--non-interactive'], { stdio: 'inherit' })
} catch (error) {
  console.error(`Pencil browser setup: site build exited ${Number.isInteger(error.status) ? error.status : 1}`)
  throw error
}
const site = await sitePreview('dist/site', { ports: [port] })
console.log(`Run site at ${site.url}`)
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void site.close().then(() => process.exit(0)))
