// Fault injection interrupts a real statement boundary, without substituting
// query results. An unavailable transport also prevents compensating cleanup.
export function disconnectAt(database, predicate) {
  const statements = new WeakMap();
  let disconnected = false;
  const check = () => { if (disconnected) throw new Error('Synthetic custody transport disconnected'); };
  const wrap = (statement, sql) => {
    const result = {
      bind(...params) { return wrap(statement.bind(...params), sql); },
      async first(...args) { check(); return statement.first(...args); },
      async all(...args) { check(); return statement.all(...args); },
    };
    statements.set(result, { statement, sql }); return result;
  };
  return { get disconnected() { return disconnected; }, database: {
    prepare(sql) { check(); return wrap(database.prepare(sql), sql); },
    async batch(batch) {
      check();
      const raw = batch.map(statement => statements.get(statement));
      if (predicate(raw.map(row => row.sql))) { disconnected = true; check(); }
      return database.batch(raw.map(row => row.statement));
    },
  } };
}

export function sqliteD1(database) {
  const statements = new WeakMap();
  const prepare = (sql, params = []) => {
    const statement = { bind: (...values) => prepare(sql, values),
      async first() { return database.prepare(sql).get(...params) ?? null; },
      async all() { return { results: database.prepare(sql).all(...params) }; } };
    statements.set(statement, { sql, params }); return statement;
  };
  return { prepare, async batch(batch) {
    database.exec('BEGIN');
    try {
      const results = batch.map(statement => { const { sql, params } = statements.get(statement);
        return { results: database.prepare(sql).all(...params), success: true }; });
      database.exec('COMMIT'); return results;
    } catch (error) { database.exec('ROLLBACK'); throw error; }
  } };
}
