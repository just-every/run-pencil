import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const target = process.env.PENCIL_PREVIEW_URL
if (!target) {
  console.error('PENCIL_PREVIEW_URL is required for preview health verification. Supply the owner-confirmed HTTPS preview URL after deployment.')
  process.exit(1)
}
const expectedBuildId = process.env.PENCIL_EXPECTED_BUILD_ID
if (!expectedBuildId) {
  console.error('PENCIL_EXPECTED_BUILD_ID is required so preview verification can identify the candidate it is probing.')
  process.exit(1)
}

let base
try {
  base = new URL(target)
} catch {
  console.error('PENCIL_PREVIEW_URL must be an absolute HTTPS URL.')
  process.exit(1)
}
if (base.protocol !== 'https:') {
  console.error('PENCIL_PREVIEW_URL must use HTTPS.')
  process.exit(1)
}

const seed = JSON.parse(await readFile(resolve(root, 'seed.json'), 'utf8'))
const healthUrl = new URL(seed.deploy.healthPath, base)
const startedAt = performance.now()
let response
try {
  response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000), headers: { accept: 'application/json' } })
} catch (error) {
  console.error(`Preview health request failed within the one-second contract window: ${error.message}`)
  process.exit(1)
}
const duration = Math.round(performance.now() - startedAt)
let payload
try {
  payload = await response.json()
} catch {
  console.error(`Preview health endpoint returned non-JSON with HTTP ${response.status} in ${duration}ms.`)
  process.exit(1)
}
if (response.status !== 200 || payload?.status !== 'ok' || payload?.product !== 'pencil' || payload?.buildId !== expectedBuildId) {
  console.error(`Preview health endpoint is not ready: HTTP ${response.status}, payload ${JSON.stringify(payload)}.`)
  process.exit(1)
}
console.log(`Preview health verified for Pencil build ${expectedBuildId} at ${healthUrl.origin}${healthUrl.pathname} in ${duration}ms.`)
