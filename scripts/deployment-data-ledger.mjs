import { classify } from './deployment-data-policy.mjs';

export const ledger = { name: 'd1_migrations', columns: ['id', 'name', 'applied_at'] };
export const kitLedger = { name: '_rer_deploy_migrations', columns: ['name', 'sha256', 'state'] };
export const kitLedgerSQL = "CREATE TABLE _rer_deploy_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('applying','applied')))";
// Both ledgers together are deliberately invalid: recovery never guesses which
// controller owns history. Hidden/generated columns are included in this check.
// SQLite's final ALTER TABLE quotes the published table name. Those are the
// two controller-owned definitions; do not normalize SQL literals or CHECKs.
const kitSchemas = [kitLedgerSQL, kitLedgerSQL.replace('_rer_deploy_migrations', '"_rer_deploy_migrations"')]
  .map(sql => `'${sql.replaceAll("'", "''")}'`).join(',');
export const ledgerShapeQuery = `SELECT cid,name,upper(type) AS type,"notnull",dflt_value,pk,hidden FROM pragma_table_xinfo('d1_migrations')
UNION ALL SELECT cid,name,upper(type) AS type,"notnull",dflt_value,pk,hidden FROM pragma_table_xinfo('_rer_deploy_migrations')
WHERE (SELECT sql FROM sqlite_schema WHERE name='_rer_deploy_migrations') IN (${kitSchemas})
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
const mismatch = () => Object.assign(new Error('D1 migration ledger differs from its explicit schema or committed migration history.'), { recoveryCode: 'MIGRATION_MISMATCH' });
export function assertLedgerShape(rows) {
  const result = JSON.stringify(rows) === JSON.stringify(ledgerShape) ? ledger : JSON.stringify(rows) === JSON.stringify(kitLedgerShape) ? kitLedger : null;
  if (!result) throw mismatch();
  classify(result);
  return result;
}
export function checkedLedger(database) { return assertLedgerShape(database.prepare(ledgerShapeQuery).all()); }
export function validateLedger(table, migrations) {
  const expected = table.name === kitLedger.name ? kitLedger : ledger;
  if (table.name !== expected.name || JSON.stringify(table.columns) !== JSON.stringify(expected.columns)) throw mismatch();
  const values = table.rows.map(row => row.map(cell => cell.type === 'text' ? cell.value : null));
  const history = expected === kitLedger ? values.map(([name, sha256, state]) => ({name, sha256, state})).sort((a,b)=>a.name?.localeCompare(b.name)) : values.map(row => row[1]).sort();
  const wanted = expected === kitLedger ? migrations.map(row => ({...row, state:'applied'})) : migrations.map(row => row.name);
  if (JSON.stringify(history) !== JSON.stringify(wanted)) throw mismatch();
  return expected;
}
export function historyGuard(table, migrations) {
  if (table.name === kitLedger.name) return { sql: "(SELECT json_group_array(json_object('name',name,'sha256',sha256,'state',state)) FROM (SELECT name,sha256,state FROM _rer_deploy_migrations ORDER BY name))=?", params: [JSON.stringify(migrations.map(row=>({...row,state:'applied'})))] };
  return { sql: "(SELECT group_concat(name,',') FROM (SELECT name FROM d1_migrations ORDER BY name))=?", params:[migrations.map(row=>row.name).join(',')] };
}
