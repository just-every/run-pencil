import { initializedPredicate, initializedReplacement } from './deployment-data-initialized.mjs';
// Shared by the REST client and real D1 runtime checks. Values are always bound;
// the only executable schema is supplied by the locally committed migrations.
import { ledgerDefinition, ledgerShapeQuery, historyGuard, keepsHistory } from './deployment-data-ledger.mjs';
export { ledger } from './deployment-data-ledger.mjs';
export const quote = name => `"${name.replaceAll('"', '""')}"`;
// Cloudflare owns both metadata tables, and Base's demo guard owns rer_demo (present only under RER_DEMO);
// none belongs to the Pencil product graph.
export const schemaQuery = "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name NOT IN ('_cf_METADATA','_cf_KV','rer_demo') AND name NOT IN ('d1_migrations','_rer_deploy_migrations','rer_migrations') ORDER BY type, name";
export function rowExpression(table) {
  const cells = table.columns.map(name => {
    const column = quote(name);
    return `CASE typeof(${column}) WHEN 'null' THEN json_object('type','null') WHEN 'integer' THEN json_object('type','integer','value',CAST(${column} AS TEXT)) WHEN 'blob' THEN json_object('type','blob','hex',hex(${column})) WHEN 'real' THEN json_object('type','real','value',${column}) ELSE json_object('type','text','value',${column}) END`;
  });
  return `json_array(${cells.join(',')})`;
}
export function readStatement(table) { return { sql: `SELECT ${rowExpression(table)} AS cells FROM ${quote(table.name)}` }; }
export function insertStatement(table, row, toHex) {
  const params = [];
  const expressions = row.map(cell => {
    if (cell.type === 'null') return 'NULL';
    if (cell.type === 'blob') {
      const hex = toHex(cell.value), chunks = [];
      for (let offset=0;offset<hex.length;offset+=128*1024) { params.push(hex.slice(offset,offset+128*1024)); chunks.push('unhex(?)'); }
      if (!chunks.length) return "X''";
      return chunks.length===1 ? chunks[0] : `CAST((${chunks.join(' || ')}) AS BLOB)`;
    }
    params.push(String(cell.value));
    if (cell.type === 'integer') return 'CAST(? AS INTEGER)';
    if (cell.type === 'real') return 'CAST(? AS REAL)';
    return '?';
  });
  return { sql: `INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(',')}) VALUES (${expressions.join(',')})`, params };
}
export function restoreStatements(archive, trustedSchema, toHex) {
  const tables = archive.payload.tables;
  const history = historyGuard(archive.payload.d1Migrations, archive.payload.migrations);
  const schemaExpression = `SELECT json_group_array(json_object('type',type,'name',name,'tbl_name',tbl_name,'sql',sql)) FROM (${schemaQuery})`;
  const failUnless = (expression, params = []) => ({ sql: `SELECT CASE WHEN (${expression}) THEN 1 ELSE json('Restore precondition failed') END AS verified`, params });
  const statements = [
    failUnless(`(SELECT json_group_array(json_object('cid',cid,'name',name,'type',type,'notnull',"notnull",'dflt_value',dflt_value,'pk',pk,'hidden',hidden)) FROM (${ledgerShapeQuery})) = ?`, [JSON.stringify(ledgerDefinition(archive.payload.d1Migrations).shape)]),
    failUnless(`(${schemaExpression}) = ?`, [archive.payload.schema]),
    failUnless(history.sql, history.params),
    // Independent guards avoid D1's compound-SELECT term limit. They still all
    // run before any write in this same atomic restore batch.
    ...tables.map(table => { const expected = initializedPredicate(table); return failUnless(expected.sql, expected.params); }),
    { sql: 'PRAGMA defer_foreign_keys = ON' },
  ];
  const triggers = trustedSchema.filter(entry => entry.type === 'trigger');
  statements.push(...triggers.map(trigger => ({ sql: `DROP TRIGGER ${quote(trigger.name)}` })));
  const kept = keepsHistory(archive.payload.d1Migrations);
  if (!kept) statements.push({ sql: `DELETE FROM ${quote(archive.payload.d1Migrations.name)}` });
  statements.push(...initializedReplacement(tables));
  for (const table of kept ? tables : [archive.payload.d1Migrations, ...tables]) {
    for (const row of table.rows) statements.push(insertStatement(table, row, toHex));
  }
  statements.push(...triggers.map(trigger => ({ sql: trigger.sql })));
  // Fail within the same batch rather than discovering broken relationships
  // after committing. D1 also checks deferred foreign keys on commit.
  statements.push(failUnless('NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check)'));
  return statements;
}

// A bounded JSON parameter packs small rows without growing SQL or binding
// counts. Large individual rows use the ordinary typed binding statement.
export function insertRowsStatement(table, rows, toHex) {
  const values = table.columns.map((_,index) => {
    const type = `json_extract(value,'$[${index}].type')`, cell = `json_extract(value,'$[${index}].value')`;
    return `CASE ${type} WHEN 'null' THEN NULL WHEN 'integer' THEN CAST(${cell} AS INTEGER) WHEN 'real' THEN CAST(${cell} AS REAL) WHEN 'blob' THEN unhex(${cell}) ELSE ${cell} END`;
  });
  const cells = rows.map(row=>row.map(cell=>cell.type==='blob'?{type:'blob',value:toHex(cell.value)}:cell));
  return {sql:`INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(',')}) SELECT ${values.join(',')} FROM json_each(?)`,params:[JSON.stringify(cells)]};
}
