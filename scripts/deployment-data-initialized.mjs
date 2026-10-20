import { failure } from './deployment-data-errors.mjs';
import unicode from './search-unicode-data.json' with { type: 'json' };
const encodedRows = rows => rows.map(row => row.map(value => ({ type: typeof value === 'number' ? 'integer' : 'text', value: String(value) })))
  .sort((a,b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
// These rows are migration-owned initialization, not an exemption for a table.
// The migration source check binds this seed to the product schema export.
export const initializedRows = {
  search_unicode_map: { columns: ['code', 'value', 'ccc'], rows: encodedRows(unicode.map) },
  search_unicode_composition: { columns: ['first', 'second', 'composed'], rows: encodedRows(unicode.composition) },
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
  // One bound JSON set keeps the SQL shallow and bounded for Unicode's immutable
  // lookup rows. Exact cardinality, values and storage types still fail closed.
  const values = expected.rows.map(row => row.map(cell => cell.type === 'integer' ? Number(cell.value) : cell.value));
  const columns = expected.columns.map((column,index) => {
    const type = expected.rows[0][index].type;
    if (!['integer','text'].includes(type) || expected.rows.some(row => row[index].type !== type)) throw new Error('Unsupported initialized baseline cell.');
    return `typeof(${quote(column)})='${type}' AND ${quote(column)} IS json_extract(expected.value,'$[${index}]')`;
  });
  return { sql: `(SELECT count(*) FROM ${name})=? AND NOT EXISTS (SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS (SELECT 1 FROM ${name} WHERE ${columns.join(' AND ')}))`, params: [expected.rows.length, JSON.stringify(values)] };
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
