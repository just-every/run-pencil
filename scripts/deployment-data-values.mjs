import { readStatement } from './deployment-data-sql.mjs';

// SQLite serializes text into JSON before it crosses the Node driver. This
// preserves embedded NULs; integers remain decimal strings and blobs hex.
export function readCells(json) {
  return JSON.parse(json).map(cell => cell.type === 'blob'
    ? { type: 'blob', value: Buffer.from(cell.hex, 'hex').toString('base64') }
    : cell);
}
export function* tableRows(database, table) {
  for (const row of database.prepare(readStatement(table).sql).iterate()) yield readCells(row.cells);
}
