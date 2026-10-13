import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validToken } from '../src/base/operator-auth/crypto.mjs'

// These subjects belong to Base authentication. Notification subjects include
// owner-authored brand/form text, and even their first link can be untrusted.
const authSubjects = new Set(['Your sign-in link for Pencil', 'You&#39;re invited to Pencil', 'Confirm it&#39;s you in Pencil'])
/** The checkout's dev key as a request header. The local outbox answers only a request that holds it (rer setup writes it). */
export function devKeyHeaders(root = process.cwd()) {
  const key = /^RER_DEV_KEY=(\S+)$/m.exec(readFileSync(join(root, '.rer/local/dev-key.env'), 'utf8'))?.[1]
  if (!key) throw new Error('This checkout has no dev key. Run rer setup first.')
  return { 'x-rer-dev-key': key }
}
/** Read the actual Base viewer, including each authentication document. Review and test
 * extraction keeps journeys on the production capture/viewer/confirmation path. */
export async function developmentInbox(get, email) {
  const document = async path => {
    const response = await get(path)
    const status = typeof response.status === 'function' ? response.status() : response.status
    if (status !== 200) throw new Error(`Base outbox read failed (${status}).`)
    return response.text()
  }
  const html = await document('/__dev/outbox')
  const messages = []
  for (const article of html.matchAll(/<article>([\s\S]*?)<\/article>/g)) {
    if (!article[1].includes(`<p>To: ${email}</p>`)) continue
    if (!authSubjects.has(article[1].match(/^<h2>([\s\S]*?)<\/h2>/)?.[1])) continue
    const path = article[1].match(/href="([^\"]+\?message=[^\"]+)"/)?.[1]
    if (!path) throw new Error('Base outbox message is missing its reader link.')
    const detail = await document(path.replaceAll('&amp;', '&'))
    const link = detail.match(/class="open" href="([^\"]+)"/)?.[1]
    const confirmation = link ? new URL(link.replaceAll('&amp;', '&')) : null
    const token = confirmation?.searchParams.get('token')
    if (confirmation?.pathname !== '/auth/confirm' || !validToken(token)) throw new Error('Base authentication mail is missing its confirmation link.')
    messages.push({ id: new URL(path, 'http://localhost').searchParams.get('message'), magicLinkToken: token })
  }
  return { messages }
}
