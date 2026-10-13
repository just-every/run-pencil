import { classify } from './deployment-data-policy.mjs';

export const ledger = { name: 'd1_migrations', columns: ['id', 'name', 'applied_at'] };
// Check every column, including generated/hidden columns, before selecting any
// ledger values. SQL spelling/case may differ between SQLite and D1.
export const ledgerShapeQuery = `SELECT cid,name,upper(type) AS type,"notnull",dflt_value,pk,hidden FROM pragma_table_xinfo('d1_migrations') ORDER BY cid`;
export const ledgerShape = [
  { cid: 0, name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1, hidden: 0 },
  { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0, hidden: 0 },
  { cid: 2, name: 'applied_at', type: 'TIMESTAMP', notnull: 1, dflt_value: 'CURRENT_TIMESTAMP', pk: 0, hidden: 0 },
];
export function assertLedgerShape(rows) {
  if (JSON.stringify(rows) !== JSON.stringify(ledgerShape)) {
    throw Object.assign(new Error('D1 migration ledger schema differs from its explicit column classification.'), { recoveryCode: 'MIGRATION_MISMATCH' });
  }
  classify(ledger);
}
export function checkedLedger(database) {
  assertLedgerShape(database.prepare(ledgerShapeQuery).all());
  return ledger;
}
