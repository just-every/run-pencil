import { test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { openStateDatabase } from './state-database'
import { ulid } from 'ulid'
/** Additive synthetic identity per journey. Every login still uses Base mail and
 * confirmation; the sample owner, actual auth limits and existing rows remain. */
export function operatorEmail() {
  const info = test.info()
  const key = createHash('sha256').update(`${info.testId}:${info.project.name}:${info.retry}`).digest('hex').slice(0,24)
  const email = `native-${key}@example.test`
  const directory = process.env.PENCIL_MIGRATION_STATE!
  const file = readdirSync(directory).find(name => name.endsWith('.sqlite'))!
  const db = openStateDatabase(join(directory,file))
  try {
    const now = new Date().toISOString()
    db.prepare(`INSERT OR IGNORE INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at)
      SELECT ?,id,?,name || ' synthetic journey operator',0,?,? FROM workspaces ORDER BY created_at,id LIMIT 1`).run(ulid(),email,now,now)
    return email
  } finally { db.close() }
}
