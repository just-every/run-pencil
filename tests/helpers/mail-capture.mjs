import { readFileSync } from 'node:fs'
import { join } from 'node:path'
export function devKeyHeaders(root = process.cwd()) {
  const key = /^RER_DEV_KEY=(\S+)$/m.exec(readFileSync(join(root, '.rer/local/dev-key.env'), 'utf8'))?.[1]
  if (!key) throw new Error('This checkout has no dev key. Run rer setup first.')
  return { 'x-rer-dev-key': key }
}

export async function developmentInbox(get, email) {
  const response = await get('/__test/mail')
  const status = typeof response.status === 'function' ? response.status() : response.status
  if (status !== 200) throw new Error(`Test mail edge read failed (${status}).`)
  const { messages } = JSON.parse(await response.text())
  return { messages: messages.filter(message => (Array.isArray(message.to) ? message.to : [message.to]).some(to => (typeof to === 'string' ? to : to.email) === email)).flatMap(message => {
    const token = /[?&]token=([A-Za-z0-9_-]{43})/.exec(message.text ?? message.html ?? '')?.[1]
    return token ? [{ id: message.id, magicLinkToken: token }] : []
  }) }
}
