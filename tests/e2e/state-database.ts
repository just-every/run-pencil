import { DatabaseSync } from 'node:sqlite'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Identify the migrated application by its schema, independently of workerd's
 * auxiliary SQLite databases and filesystem enumeration order. */
export function stateDatabaseFile(directory: string) {
  const files = readdirSync(directory).filter(name => name.endsWith('.sqlite')).filter(name => {
    const database = new DatabaseSync(join(directory, name), { readOnly: true })
    try {
      return !!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='workspaces'").get()
    } finally { database.close() }
  })
  if (files.length !== 1) throw new Error('The native check requires exactly one migrated application database.')
  return join(directory, files[0])
}

/** Native fixtures share persisted SQLite with the live Worker. A short writer
 * may finish before fixture access; a held lock still fails within one second. */
export function openStateDatabase(filename: string) {
  const db = new DatabaseSync(filename)
  try {
    db.exec('PRAGMA busy_timeout = 1000')
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
