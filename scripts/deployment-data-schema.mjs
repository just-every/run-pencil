import { failure } from './deployment-data-errors.mjs';
import { quote } from './deployment-data-sql.mjs';

// Only trusted migration SQL is rewritten. Quoted literals and comments remain
// intact; replacement names are always quoted identifiers.
const tokens = sql => sql.match(/--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[A-Za-z_][A-Za-z_0-9]*|\s+|./g) ?? [];
const identifier = token => /^[A-Za-z_]\w*$/.test(token) ? token : /^"(?:""|[^"])*"$/.test(token) ? token.slice(1,-1).replaceAll('""','"') : undefined;
export function renameSQL(sql, names) {
  return tokens(sql).map(token => Object.hasOwn(names, identifier(token)) ? quote(names[identifier(token)]) : token).join('');
}
export function schemaEquivalent(actual, expected) {
  if (actual.length !== expected.length) return false;
  // SQLite ALTER TABLE quotes identifiers when it updates stored SQL. Compare
  // its token stream, preserving literals, operators, constraints and collations.
  const identifiers = new Set(expected.flatMap(row => [row.name,row.tbl_name]));
  for (const row of expected.filter(row=>row.type==='table')) {
    let depth=0, first=false;
    for (const token of tokens(row.sql).filter(token=>!/^\s+$|^--|^\/\*/.test(token))) {
      if(token==='(') {depth++;if(depth===1)first=true;continue;}
      if(token===')') {depth--;continue;}
      if(token===','&&depth===1) {first=true;continue;}
      if(depth===1&&first) {
        const name=identifier(token);
        if(name&&(!/^(?:CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)$/i.test(name)||token.startsWith('"')))identifiers.add(name);
        first=false;
      }
    }
  }
  const normalize = sql => tokens(sql).filter(token => !/^\s+$|^--|^\/\*/.test(token)).map(token => {
    const name = identifier(token); return name && identifiers.has(name) ? name : token;
  });
  return actual.every((row,index) => {
    const wanted = expected[index];
    return row.type === wanted.type && row.name === wanted.name && row.tbl_name === wanted.tbl_name && JSON.stringify(normalize(row.sql)) === JSON.stringify(normalize(wanted.sql));
  });
}
export function canonicalSchema(actual, expected) {
  if (!schemaEquivalent(actual, JSON.parse(expected))) throw failure('SCHEMA_MISMATCH', 'Deployed schema differs; apply the committed migrations first.');
  return expected;
}
