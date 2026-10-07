import { DatabaseSync } from 'node:sqlite'
/** Test adapter: actual SQLite transactions implement the same D1 batch semantics. */
export function sqliteD1(database: DatabaseSync) {
  function prepare(sql: string) {
    let values: any[] = []
    const query = () => database.prepare(sql)
    const statement = {
      bind(...args: unknown[]) { values = args; return statement },
      async first() { return query().get(...values) ?? null },
      async all() { return { results: query().all(...values), meta: { changes: 0 } } },
      async run() { const statement = query(); const rows = statement.columns().length ? statement.all(...values) : (statement.run(...values), []); return { results: rows, meta: { changes: Number(database.prepare('SELECT changes() n').get()!.n) } } },
    }
    return statement
  }
  return { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    database.exec('BEGIN IMMEDIATE')
    try { const result = []; for (const statement of statements) result.push(await statement.run()); database.exec('COMMIT'); return result }
    catch (error) { database.exec('ROLLBACK'); throw error }
  } }
}
