import { env } from 'cloudflare:test'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'

export async function matureLoad(session: { sessionId: string; loadTime?: string }, milliseconds = 6000) {
  const row = await env.DB.prepare('SELECT revision_id FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first<{ revision_id: string }>()
  if (!row) throw new Error('Cannot mature a missing respondent session.')
  const at = Date.now() - milliseconds
  const token = await issueLoadTime(env.SESSION_SECRET, row.revision_id, at)
  await env.DB.prepare('UPDATE respondent_sessions SET created_at = ? WHERE id = ?').bind(new Date(at).toISOString(), session.sessionId).run()
  session.loadTime = token
}
