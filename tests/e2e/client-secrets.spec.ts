import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { expect } from './fixtures'
import { contract } from './contract'
contract(['BASE-SECRET-001'], 'the real emitted client assets exclude local credentials and match the served bytes', async ({ request }) => {
  const configuration=parseEnv(readFileSync('.pencil-e2e-state/.dev.vars','utf8'))
  const secret=configuration.SESSION_SECRET
  expect(typeof secret === 'string' && secret.length > 0, 'The native runtime credential is present').toBe(true)
  const directory='dist/client/assets'
  const scripts=readdirSync(directory).filter(name=>name.endsWith('.js'))
  expect(scripts.length).toBeGreaterThan(0)
  for(const name of scripts){
    const text=readFileSync(join(directory,name),'utf8')
    expect(text.includes(secret),name).toBe(false)
    const response=await request.get(`/assets/${name}`)
    expect(response.status(),name).toBe(200)
    expect(await response.text() === text,name).toBe(true)
  }
})
