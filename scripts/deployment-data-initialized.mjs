import { failure } from './deployment-data-errors.mjs';
// These rows are migration-owned initialization, not an exemption for a table.
// The migration source check binds this seed to the product schema export.
export const initializedRows = {
  form_import_native_clock: { columns: ['id', 'revision'], rows: [[{ type: 'integer', value: '1' }, { type: 'integer', value: '1' }]] },
};
const quote = value => `"${value.replaceAll('"', '""')}"`;
export function initializedTable(table) {
  const expected = initializedRows[table.name];
  if (!expected) return { ...table, rows: [] };
  if (JSON.stringify(table.columns) !== JSON.stringify(expected.columns)) throw new Error('Initialized table columns differ from the explicit migration baseline.');
  return { ...table, rows: expected.rows };
}
export function initializedPredicate(table) {
  const expected = initializedTable(table), name = quote(table.name);
  if (!expected.rows.length) return { sql: `NOT EXISTS (SELECT 1 FROM ${name})`, params: [] };
  const params = [expected.rows.length];
  const rows = expected.rows.map(row => {
    const columns = row.map((cell, index) => {
      if (cell.type !== 'integer') throw new Error('Unsupported initialized baseline cell.');
      params.push(cell.value);
      const column = quote(expected.columns[index]);
      return `typeof(${column})='integer' AND ${column} IS CAST(? AS INTEGER)`;
    });
    return `EXISTS (SELECT 1 FROM ${name} WHERE ${columns.join(' AND ')})`;
  });
  return { sql: `(SELECT count(*) FROM ${name})=? AND ${rows.join(' AND ')}`, params };
}
export function initializedReplacement(tables) {
  // Call only after every baseline predicate succeeds and triggers are disabled.
  return tables.filter(table => initializedTable(table).rows.length).map(table => ({ sql: `DELETE FROM ${quote(table.name)}` }));
}

export function assertInitialized(database, tables) {
  for (const table of tables) {
    const expected = initializedPredicate(table);
    if (database.prepare(`SELECT CASE WHEN (${expected.sql}) THEN 1 ELSE 0 END AS matches`).get(...expected.params).matches !== 1)
      throw failure('NONEMPTY_TARGET', 'Destination contains application records; nothing was written.');
  }
}
