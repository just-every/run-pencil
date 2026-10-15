// A test-only, read-only observation window, using the run-demo environment.
// Retain admission metadata only: never visitor cookies, IPs, headers or bodies.
import { mkdir, writeFile } from 'node:fs/promises'
const account = process.env.CLOUDFLARE_ACCOUNT_ID
if (account !== 'b20c0ca9cab0c2b70e13d7cf724b89bd') throw Error('Wrong demo account')
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/pencil-demo-test--demo/tails`
const headers = { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' }
const response = await fetch(endpoint, { method: 'POST', headers, body: '{}' })
const result = await response.json()
if (!result.success) throw Error(`Cannot observe demo admissions: HTTP ${response.status}`)
const { id, url } = result.result
const admissions = [], startedAt = new Date().toISOString()
let failure, socket
try {
  socket = new WebSocket(url, 'trace-v1')
  socket.binaryType = 'arraybuffer'
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', () => reject(Error('Demo tail connection failed')), { once: true })
  })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 15 * 60 * 1000)
    socket.addEventListener('close', () => { clearTimeout(timer); reject(Error('Demo tail closed before observation completed')) }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(Error('Demo tail failed during observation')) }, { once: true })
    socket.addEventListener('message', message => {
      try {
        const event = JSON.parse(typeof message.data === 'string' ? message.data : new TextDecoder().decode(message.data))
        for (const log of event.logs ?? []) for (const part of log.message ?? []) {
          if (typeof part !== 'string' || !part.startsWith('{')) continue
          const record = JSON.parse(part)
          if (record.event === 'demo_admitted') admissions.push({ at: record.at, correlation: record.correlation })
        }
      } catch { clearTimeout(timer); reject(Error('Cannot parse demo admission tail')) }
    })
    console.log('Observing test-host admissions for 15 minutes; do not start visitors yet.')
  })
} catch (error) { failure = error.message }
finally {
  socket?.close()
  const deleted = await fetch(`${endpoint}/${id}`, { method: 'DELETE', headers })
  if (!deleted.ok) failure ??= `Cannot remove demo tail: HTTP ${deleted.status}`
}
await mkdir('.rer', { recursive: true })
const report = { startedAt, endedAt: new Date().toISOString(), admissions, failure: failure ?? null, quiet: !failure && admissions.length === 0 }
await writeFile('.rer/demo-test-admissions.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report))
if (!report.quiet) process.exitCode = 1
