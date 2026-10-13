import { vi } from 'vitest'

// Track SQL through real prepare/bind calls. Every read and batch still runs on
// native D1; the callback schedules a competing write only at the final mutation.
export function interceptCustodyCommit(database: D1Database, action: 'index' | 'erase', beforeCommit: () => Promise<void>) {
  const prepare = database.prepare.bind(database), batch = database.batch.bind(database)
  const tracked = new WeakMap<D1PreparedStatement, { statement: D1PreparedStatement; sql: string }>()
  const state = { initialAuthorizedBatch: false, jobRead: false, nativeTargetRead: false,
    mutationReached: false, authorizedBeforeMutation: false, readBeforeMutation: false }
  const observeRead = (sql: string, nonempty: boolean) => {
    if (!state.initialAuthorizedBatch || state.mutationReached || !nonempty) return
    if (/\bFROM\s+ik_jobs\b/i.test(sql)) state.jobRead = true
    if (/\bFROM\s+form_import_targets\b/i.test(sql)) state.nativeTargetRead = true
  }
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, { get(target, property) {
      if (property === 'bind') return (...params: unknown[]) => wrap(target.bind(...params), sql)
      if (property === 'first') return async (...args: Parameters<D1PreparedStatement['first']>) => {
        const result = await target.first(...args)
        observeRead(sql, result !== null)
        return result
      }
      if (property === 'all') return async () => {
        const result = await target.all()
        observeRead(sql, result.results.length > 0)
        return result
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    tracked.set(proxy, { statement, sql })
    return proxy
  }
  const prepared = vi.spyOn(database, 'prepare').mockImplementation(sql => wrap(prepare(sql), sql))
  const committed = vi.spyOn(database, 'batch').mockImplementation(async statements => {
    const rows = statements.map(statement => {
      const row = tracked.get(statement)
      if (!row) throw new Error('Untracked native custody statement')
      return row
    })
    const mutation = action === 'index'
      ? rows.some(row => /^DELETE FROM ik_d1_plan_index\b/.test(row.sql))
      : rows.some(row => /^DELETE FROM responses\b/.test(row.sql)) && rows.some(row => row.sql.includes("'response.erased'"))
    if (!state.mutationReached && mutation) {
      state.authorizedBeforeMutation = state.initialAuthorizedBatch
      state.readBeforeMutation = state.jobRead && (action === 'index' || state.nativeTargetRead)
      state.mutationReached = true
      await beforeCommit()
    }
    const result = await batch(rows.map(row => row.statement))
    const authorizationOnly = rows.some(row => row.sql.includes('oa_sessions')) && rows.every(row =>
      row.sql.startsWith('INSERT INTO ik_d1_assertions') || row.sql === 'DELETE FROM ik_d1_assertions' ||
      // Base's import kit authorizes erasure and index preparation with a SELECT-only fence before any read.
      (row.sql.startsWith('SELECT CASE WHEN (') && row.sql.endsWith(') THEN 1 ELSE 0 END AS ok')) ||
      (row.sql.startsWith('SELECT CASE WHEN (') && row.sql.includes('oa_sessions') && row.sql.includes("json('IMPORT_FINAL_GUARD')")))
    if (!state.mutationReached && authorizationOnly) state.initialAuthorizedBatch = true
    return result
  })
  return { state, restore() { committed.mockRestore(); prepared.mockRestore() } }
}
