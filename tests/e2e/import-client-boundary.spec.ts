import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from './fixtures'
import { contract } from './contract'

const serverMarkers = [
  'ik_d1_staging', 'ik_d1_plan_chunks', 'ik_d1_creation_plans',
  'ik_d1_reversal_reports', 'createHash',
]

contract('BASE-SECRET-001', 'real served client assets exclude maintained import storage and server crypto implementations', async ({ request }) => {
  const directory = 'dist/client/assets'
  const scripts = readdirSync(directory, { recursive: true }).filter((name): name is string => typeof name === 'string' && name.endsWith('.js')).sort()
  expect(scripts.length > 0, 'client JavaScript assets were emitted').toBe(true)
  // One request per address: every built chunk is fetched in one minute, which would otherwise spend the shared per-address public request limit that stays enforced.
  for (const [index, name] of scripts.entries()) {
    const bytes = readFileSync(join(directory, name))
    expect(bytes.length > 0, `client asset is nonempty: ${name}`).toBe(true)
    for (const marker of serverMarkers) {
      expect(bytes.includes(marker), `server implementation marker ${marker} in ${name}`).toBe(false)
    }
    const response = await request.get(`/assets/${name}`, { headers: { 'CF-Connecting-IP': `198.18.201.${index % 250 + 1}` } })
    expect(response.status() === 200, `client asset HTTP status: ${name}`).toBe(true)
    expect((await response.body()).equals(bytes), `served client asset matches emitted bytes: ${name}`).toBe(true)
  }
})
