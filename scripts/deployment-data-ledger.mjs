import { classify } from './deployment-data-policy.mjs';

export const ledger = { name: 'd1_migrations', columns: ['id', 'name', 'applied_at'] };
export const hashedLedger = { name: 'd1_migrations', columns: ['id', 'name', 'applied_at', 'sha256', 'state'] };
export const hashedLedgerSQL = "CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sha256 TEXT, state TEXT CHECK(state IN ('applying','applied')))";
export const kitLedger = { name: '_rer_deploy_migrations', columns: ['name', 'sha256', 'state'] };
export const kitLedgerSQL = "CREATE TABLE _rer_deploy_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('applying','applied')))";
// Both ledgers together are deliberately invalid: recovery never guesses which
// controller owns history. Hidden/generated columns are included in this check.
// SQLite's final ALTER TABLE quotes the published table name. Those are the
// two controller-owned definitions; do not normalize SQL literals or CHECKs.
const schemas = (sql, name) => [sql, sql.replace(name, `"${name}"`)]
  .map(value => `'${value.replaceAll("'", "''")}'`).join(',');
export const ledgerShapeQuery = `SELECT cid,name,upper(type) AS type,"notnull",dflt_value,pk,hidden FROM pragma_table_xinfo('d1_migrations')
WHERE (SELECT count(*) FROM pragma_table_xinfo('d1_migrations'))=3
OR (SELECT sql FROM sqlite_schema WHERE name='d1_migrations') IN (${schemas(hashedLedgerSQL, hashedLedger.name)})
UNION ALL SELECT cid,name,upper(type) AS type,"notnull",dflt_value,pk,hidden FROM pragma_table_xinfo('_rer_deploy_migrations')
WHERE (SELECT sql FROM sqlite_schema WHERE name='_rer_deploy_migrations') IN (${schemas(kitLedgerSQL, kitLedger.name)})
UNION ALL SELECT -1,'mixed-ledgers','',0,NULL,0,0 WHERE
(SELECT count(*) FROM sqlite_schema WHERE type='table' AND name IN ('d1_migrations','_rer_deploy_migrations'))=2 ORDER BY cid`;
export const ledgerShape = [
  { cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1, hidden: 0 },
  { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
  { cid: 2, name: 'applied_at', type: 'TIMESTAMP', notnull: 1, dflt_value: 'CURRENT_TIMESTAMP', pk: 0, hidden: 0 },
];
export const kitLedgerShape = [
  { cid: 0, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 1, hidden: 0 },
  { cid: 1, name: 'sha256', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
  { cid: 2, name: 'state', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0, hidden: 0 },
];
export const hashedLedgerShape = [
  ledgerShape[0],
  { ...ledgerShape[1], notnull: 1 },
  { ...ledgerShape[2], type: 'TEXT' },
  { cid: 3, name: 'sha256', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
  { cid: 4, name: 'state', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
];
const definitions = [
  { table: ledger, shape: ledgerShape },
  { table: hashedLedger, shape: hashedLedgerShape },
  { table: kitLedger, shape: kitLedgerShape },
];
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const mismatch = () => Object.assign(new Error('D1 migration ledger differs from its explicit schema or committed migration history.'), { recoveryCode: 'MIGRATION_MISMATCH' });
export function ledgerDefinition(table) {
  const result = definitions.find(item => item.table.name === table.name && equal(item.table.columns, table.columns));
  if (!result) throw mismatch();
  return result;
}
export function sameLedger(left, right) {
  return ledgerDefinition(left) === ledgerDefinition(right);
}
export function assertLedgerShape(rows) {
  const result = definitions.find(item => equal(rows, item.shape))?.table;
  if (!result) throw mismatch();
  classify(result);
  return result;
}
export function checkedLedger(database) { return assertLedgerShape(database.prepare(ledgerShapeQuery).all()); }
export function validateLedger(table, migrations) {
  const { table: expected } = ledgerDefinition(table);
  const rows = [...table.rows];
  if (expected === hashedLedger) {
    if (rows.some(row => row[0]?.type !== 'integer' || !/^-?(?:0|[1-9]\d*)$/.test(row[0].value))) throw mismatch();
    rows.sort((a,b) => BigInt(a[0].value) < BigInt(b[0].value) ? -1 : BigInt(a[0].value) > BigInt(b[0].value) ? 1 : 0);
  }
  const values = rows.map(row => row.map(cell => cell.type === 'text' ? cell.value : null));
  const hashed = expected !== ledger;
  const history = hashed
    ? values.map(row => Object.fromEntries(['name', 'sha256', 'state'].map(column => [column, row[expected.columns.indexOf(column)]])))
    : values.map(row => row[1]).sort();
  if (expected === kitLedger) history.sort((a,b)=>a.name?.localeCompare(b.name));
  const wanted = hashed ? migrations.map(row => ({...row, state:'applied'})) : migrations.map(row => row.name);
  if (!equal(history, wanted)) throw mismatch();
  return expected;
}
export function historyGuard(table, migrations) {
  const { table: expected } = ledgerDefinition(table);
  if (expected !== ledger) return { sql: `(SELECT json_group_array(json_object('name',name,'sha256',sha256,'state',state)) FROM (SELECT name,sha256,state FROM ${expected.name} ORDER BY ${expected === hashedLedger ? 'id' : 'name'}))=?`, params: [JSON.stringify(migrations.map(row=>({...row,state:'applied'})))] };
  return { sql: "(SELECT group_concat(name,',') FROM (SELECT name FROM d1_migrations ORDER BY name))=?", params:[migrations.map(row=>row.name).join(',')] };
}
