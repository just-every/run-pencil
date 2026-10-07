import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from './fixtures'
import { contract } from './contract'
contract(['BASE-SECRET-001'], 'the real emitted client assets exclude local credentials and maintained server auth and mail implementations', async ({ request }) => {
  const configuration=readFileSync('wrangler.toml','utf8')
  const secret=JSON.parse(configuration.match(/^SESSION_SECRET\s*=\s*(".*")/m)![1]) as string
  const directory='dist/client/assets'
  const scripts=readdirSync(directory).filter(name=>name.endsWith('.js'))
  expect(scripts.length).toBeGreaterThan(0)
  for(const name of scripts){
    const text=readFileSync(join(directory,name),'utf8')
    expect(text,name).not.toContain(secret)
    for(const marker of ['api.sendgrid.com/v3/mail/send','api.resend.com/emails','INSERT INTO oa_tokens','SESSION_SECRET must','SETUP_TOKEN must']) expect(text,name).not.toContain(marker)
    const response=await request.get(`/assets/${name}`)
    expect(response.status(),name).toBe(200)
    expect(await response.text(),name).toBe(text)
  }
})
