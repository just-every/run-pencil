import { failure } from './deployment-data-errors.mjs';

// Local dev identity never travels. Sessions and every credential, dev or not, never travel (authorizationTables in
// deployment-data-policy.mjs); the dev credential record is dropped too and the dev personas (<as>@dev.localhost) are
// suspended. Import refuses an archive that still holds a dev credential record. These rules are not options. They run
// on every row, so the same rules apply to the in-memory and streaming paths.
const PERSONA = /@dev\.localhost$/i;
const text = value => value?.type === 'text' ? value.value : undefined;
const column = (table, name) => table.columns.indexOf(name);

// Personas stay as suspended operators, so a restored copy never signs anyone in as a persona.
export function withoutDevRows(table, rows) {
  if (table.name === 'oa_operators') {
    const email = column(table, 'email'), status = column(table, 'status');
    return rows.map(row => PERSONA.test(text(row[email]) ?? '') ? row.map((cell, index) => index === status ? { type: 'text', value: 'inactive' } : cell) : row);
  }
  return rows;
}

export function refuseDevRows(table, rows) {
  if (table.name === 'oa_dev_credentials' && rows.length > 0) throw failure('DEV_DATA', 'Archive holds local dev identity (dev-minted credential records). Export again from the source; dev identity never travels.');
}
