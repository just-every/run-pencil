import { hasProviderCredential } from './publication-patterns.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync, lstatSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(new URL('..', import.meta.url).pathname)
const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const findings = []
for (const required of ['LICENSE', 'NOTICE', 'ASSET-PROVENANCE.md']) if (!paths.includes(required)) findings.push(`${required}: required publication notice missing or untracked`)
for (const path of paths) {
  if (!existsSync(resolve(root, path))) { findings.push(`${path}: tracked input missing`); continue }
  if (/^(node_modules|dist|test-results|playwright-report|\.wrangler)\//.test(path)) findings.push(`${path}: generated runtime output must not ship`)
  if (/(^|\/)(\.env(?:\..*)?|\.dev\.vars.*|credentials.*|.*\.pem|.*\.key)$/.test(path)) findings.push(`${path}: secret-shaped filename`)
  const stat = lstatSync(resolve(root, path))
  if (!stat.isFile()) { findings.push(`${path}: nonregular publication input`); continue }
  if (stat.size > 50 * 1024 * 1024) { findings.push(`${path}: exceeds 50 MiB`); continue }
  const bytes = readFileSync(resolve(root, path))
  if (!bytes.includes(0) && hasProviderCredential(bytes.toString())) findings.push(`${path}: secret-shaped content (value suppressed)`)
}
console.log(JSON.stringify({ scope: 'current tracked tree only; not Base publish-check or all-ref flip approval', paths: paths.length, findings }, null, 2))
if (findings.length) process.exitCode = 1
