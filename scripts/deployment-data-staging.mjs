import { initializedPredicate } from './deployment-data-initialized.mjs';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { quote } from './deployment-data-sql.mjs';
import { insertStatement, insertRowsStatement, schemaQuery } from './deployment-data-sql.mjs';
import { ledgerDefinition, ledgerShapeQuery, historyGuard, keepsHistory } from './deployment-data-ledger.mjs';
import { renameSQL, canonicalSchema } from './deployment-data-schema.mjs';
import { assertQueryBudget, queryLimits } from './deployment-data-provider.mjs';

export const guard = (expression, params = []) => ({ sql: `SELECT CASE WHEN (${expression}) THEN 1 ELSE json('Restore precondition failed') END AS verified`, params });
const schemaExpression = `SELECT json_group_array(json_object('type',type,'name',name,'tbl_name',tbl_name,'sql',sql)) FROM (${schemaQuery})`;
export function destinationGuards(store, actualSchema) {
  const history = historyGuard(store.payload.d1Migrations, store.payload.migrations);
  return [
    guard(`(${schemaExpression})=?`, [actualSchema]),
    guard(`(SELECT json_group_array(json_object('cid',cid,'name',name,'type',type,'notnull',"notnull",'dflt_value',dflt_value,'pk',pk,'hidden',hidden)) FROM (${ledgerShapeQuery}))=?`, [JSON.stringify(ledgerDefinition(store.payload.d1Migrations).shape)]),
    guard(history.sql, history.params),
    ...store.payload.tables.map(table => { const expected = initializedPredicate(table); return guard(expected.sql, expected.params); }),
  ];
}
export function stagingPlan(store, trusted, restorePrefix) {
  const prefix = restorePrefix ?? `_pencil_restore_${randomBytes(12).toString('hex')}_`;
  // A kept ledger is never staged, dropped or renamed; the guards verify it in place.
  const kept = keepsHistory(store.payload.d1Migrations);
  const tables = kept ? [...store.payload.tables] : [store.payload.d1Migrations,...store.payload.tables];
  const names = Object.fromEntries(tables.map(table => [table.name, prefix + table.name]));
  const allSchema = kept ? trusted.schema.filter(row => row.tbl_name !== store.payload.d1Migrations.name) : trusted.schema;
  const indexes = allSchema.filter(row => row.type === 'index');
  const triggers = allSchema.filter(row => row.type === 'trigger');
  const views = allSchema.filter(row => row.type === 'view');
  const stateName = prefix + 'state';
  const stateSQL = `CREATE TABLE ${quote(stateName)} (singleton INTEGER PRIMARY KEY CHECK(singleton=1), archive_sha256 TEXT NOT NULL)`;
  const create = [
    { sql: stateSQL },
    { sql: `INSERT INTO ${quote(stateName)} VALUES(1,?)`, params: [store.sha256] },
    ...allSchema.filter(row => row.type === 'table').map(row => ({ sql: renameSQL(row.sql, names) })),
    ...indexes.flatMap(row => [
      { sql: renameSQL(row.sql, { [row.name]: prefix + 'keep_' + row.name }) },
      { sql: `DROP INDEX ${quote(row.name)}` },
      { sql: renameSQL(row.sql, names) },
    ]),
  ];
  const ordered = [], visited = new Set();
  const visit = table => {
    if (visited.has(table.name)) return;
    visited.add(table.name);
    for (const fk of trusted.foreignKeys[table.name]) if (fk.table !== table.name) visit(tables.find(item=>item.name===fk.table));
    ordered.push(table);
  };
  tables.forEach(visit);
  const publish = [
    ...triggers.map(row => ({ sql: `DROP TRIGGER ${quote(row.name)}` })),
    ...views.map(row => ({ sql: `DROP VIEW ${quote(row.name)}` })),
    // Child-first drops leave every staged foreign key intact. ALTER TABLE
    // updates those references as each staged table takes its original name.
    ...[...ordered].reverse().map(table => ({ sql: `DROP TABLE ${quote(table.name)}` })),
    ...ordered.map(table => ({ sql: `ALTER TABLE ${quote(names[table.name])} RENAME TO ${quote(table.name)}` })),
    ...views.map(row => ({ sql: row.sql })),
    ...triggers.map(row => ({ sql: row.sql })),
    { sql: `DROP TABLE ${quote(stateName)}` },
  ];
  const cleanup = [
    ...[...ordered].reverse().map(table => ({ sql: `DROP TABLE ${quote(names[table.name])}` })),
    ...indexes.flatMap(row => [{ sql: row.sql }, { sql: `DROP INDEX ${quote(prefix + 'keep_' + row.name)}` }]),
    { sql: `DROP TABLE ${quote(stateName)}` },
  ];
  const stagedSchema = [
    ...allSchema.filter(row => row.type !== 'index' && row.name !== store.payload.d1Migrations.name),
    ...allSchema.filter(row => row.type === 'table').map(row => ({ ...row, name: names[row.name], tbl_name: names[row.name], sql: renameSQL(row.sql,names) })),
    ...indexes.flatMap(row => [
      { ...row, name: prefix + 'keep_' + row.name, sql: renameSQL(row.sql,{[row.name]:prefix + 'keep_' + row.name}) },
      { ...row, tbl_name: names[row.tbl_name], sql: renameSQL(row.sql,names) },
    ]),
    { type:'table',name:stateName,tbl_name:stateName,sql:stateSQL },
  ].sort((a,b)=>a.type<b.type?-1:a.type>b.type?1:a.name<b.name?-1:a.name>b.name?1:0);
  return { ledgerName:store.payload.d1Migrations.name, probe:kept ? stateName : names[store.payload.d1Migrations.name], prefix, names, ordered, create, publish, cleanup, stateName, stagedSchema, sha256:store.sha256 };

}
export async function stageRows(query, store, plan) {
  let batch = [], bytes = 0;
  const toHex = value=>Buffer.from(value,'base64').toString('hex');
  const flush = async () => { if (batch.length) { assertQueryBudget(batch); await query(batch); batch = []; bytes = 0; } };
  const enqueue = async statement => {
    const size = Buffer.byteLength(JSON.stringify(statement));
    if (batch.length && (batch.length >= queryLimits.statements || bytes + size > 256 * 1024)) await flush();
    batch.push(statement); bytes += size;
  };
  for (const table of plan.ordered) {
    const index = store.payload.tables.findIndex(item=>item.name===table.name);
    const rows = table.name === store.payload.d1Migrations.name ? table.rows : store.rows(index);
    const destination = { ...table, name:plan.names[table.name] };
    let group = [], groupBytes = 0;
    const flushRows = async () => { if(group.length) { await enqueue(insertRowsStatement(destination,group,toHex));group=[];groupBytes=0; } };
    for (const row of rows) {
      const size=Buffer.byteLength(JSON.stringify(row.map(cell=>cell.type==='blob'?{type:'blob',value:toHex(cell.value)}:cell)))+1;
      if(group.length&&(group.length>=128||groupBytes+size>128*1024))await flushRows();
      if(size>128*1024) { await enqueue(insertStatement(destination,row,toHex)); }
      else {group.push(row);groupBytes+=size;}
    }
    await flushRows();
  }
  await flush();
}
export async function cleanupStage(query, plan) {
  // The presence probe distinguishes an uncommitted preparation from an
  // existing inert stage. Never drop or delete original application records.
  const [result] = await query([{ sql: 'SELECT name FROM sqlite_schema WHERE type=\'table\' AND name=?', params: [plan.probe] }]);
  if (result.results.length) {
    const [actual] = await query([{sql:schemaQuery}]);
    canonicalSchema(actual.results,JSON.stringify(plan.stagedSchema));
    const ownsStage = guard(`(SELECT archive_sha256 FROM ${quote(plan.stateName)} WHERE singleton=1)=?`,[plan.sha256]);
    // DROP TABLE with foreign keys can implicitly delete every row. Drain only
    // owned inert tables in bounded chunks before the fixed schema cleanup.
    for (const table of [...plan.ordered].reverse()) {
      const name=quote(plan.names[table.name]);
      const deletion={sql:`DELETE FROM ${name} WHERE rowid IN (SELECT rowid FROM ${name} LIMIT 512) RETURNING 1 AS removed`};
      let count=1;
      for (;;) {
        const result=await query([ownsStage,...Array.from({length:count},()=>deletion)]);
        if(result.at(-1).results.length<512)break;
        count=queryLimits.statements-1;
      }
    }
    await query([
      guard(`(${schemaExpression})=?`,[JSON.stringify(actual.results)]),
      guard(`(SELECT archive_sha256 FROM ${quote(plan.stateName)} WHERE singleton=1)=?`,[plan.sha256]),
      ...plan.cleanup,
    ]);
  }
}
