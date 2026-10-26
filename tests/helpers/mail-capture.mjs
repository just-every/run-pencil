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

// Diagnostic branch only: explicit allowlists exclude credentials and message bodies.
export async function mailDiagnostics(get, email) {
  const response = await get('/__test/mail')
  const body = JSON.parse(await response.text())
  return { status: response.status(), total: body.messages?.length, cap: body.cap ?? null,
    messages: (body.messages ?? []).map(message => {
      const text = message.text ?? message.html ?? ''
      const token = /[?&]token=([A-Za-z0-9_-]{43})/.exec(text)?.[1]
      const candidate = /[?&]token=([^\s&"<>]+)/.exec(text)?.[1]
      const recipients = (Array.isArray(message.to) ? message.to : [message.to]).map(to => typeof to === 'string' ? to : to.email)
      return { recipients, subject: message.subject, time: message.createdAt ?? message.created_at ?? null,
        recipientMatched: recipients.includes(email), tokenMatched: !!token, tokenLength: candidate?.length ?? 0 }
    }) }
}

export async function databaseDiagnostics(email) {
  const { DatabaseSync } = await import('node:sqlite')
  const { readdirSync } = await import('node:fs')
  const directory = process.env.PENCIL_MIGRATION_STATE
  const file = readdirSync(directory).find(name => name.endsWith('.sqlite'))
  const db = new DatabaseSync(join(directory, file), { readOnly: true })
  const query = (sql, ...args) => {
    try { return db.prepare(sql).all(...args) }
    catch { return { unavailable: true } }
  }
  try {
    return {
      // Limit keys are keyed hashes: stable row numbers permit correlation without publishing them.
      limits: query('SELECT rowid AS row,window,count FROM oa_limits ORDER BY rowid'),
      tokens: query('SELECT t.kind,t.created_at,t.expires_at,t.consumed_at,t.revoked_at FROM oa_tokens t JOIN oa_operators o ON o.id=t.operator_id WHERE o.email=? ORDER BY t.created_at', email),
      operators: query('SELECT status,created_at FROM oa_operators WHERE email=?', email),
      outbox: query('SELECT created_at FROM rer_mail_development_outbox ORDER BY sequence'),
      legacyOutbox: query('SELECT created_at FROM local_mail_outbox ORDER BY created_at'),
      audit: query("SELECT kind,created_at,json_extract(details_json,'$.outcome') AS outcome,json_extract(details_json,'$.code') AS code FROM audit_entries WHERE kind LIKE 'auth.magic_link_%' ORDER BY created_at"),
    }
  } finally { db.close() }
}
