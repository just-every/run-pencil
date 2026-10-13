import { failure } from './deployment-data-errors.mjs';

// Local dev identity never travels. Export drops dev sessions and every credential minted while using one (recorded in
// oa_dev_credentials) and suspends the dev personas (<as>@dev.localhost); import refuses an archive that still holds
// either. These rules are not options. They run on every row, so the same rules apply to the in-memory and streaming paths.
const PERSONA = /@dev\.localhost$/i;
const text = value => value?.type === 'text' ? value.value : undefined;
const column = (table, name) => table.columns.indexOf(name);

// Rows of oa_tokens minted while a dev session was in use. The credential record is the only place that says so.
export function devMintedTokenIds(database) {
  if (!database.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='oa_dev_credentials'").get()) return new Set();
  return new Set(database.prepare("SELECT id FROM oa_dev_credentials WHERE credential='oa_tokens'").all().map(row => row.id));
}

// Dev sessions are dropped; personas stay as suspended operators, so a restored copy never signs anyone in as a persona.
export function withoutDevRows(table, rows) {
  if (table.name === 'oa_sessions') { const kind = column(table, 'kind'); return rows.filter(row => text(row[kind]) !== 'dev'); }
  if (table.name === 'oa_operators') {
    const email = column(table, 'email'), status = column(table, 'status');
    return rows.map(row => PERSONA.test(text(row[email]) ?? '') ? row.map((cell, index) => index === status ? { type: 'text', value: 'inactive' } : cell) : row);
  }
  return rows;
}

export function refuseDevRows(table, rows) {
  const holds = table.name === 'oa_dev_credentials' ? rows.length > 0
    : table.name === 'oa_sessions' && rows.some(row => text(row[column(table, 'kind')]) === 'dev');
  if (holds) throw failure('DEV_DATA', 'Archive holds local dev identity (dev sessions or dev-minted credentials). Export again from the source; dev identity never travels.');
}
