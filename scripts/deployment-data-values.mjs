import { readStatement } from './deployment-data-sql.mjs';
import { devMintedTokenIds } from './deployment-data-dev.mjs';

// SQLite serializes text into JSON before it crosses the Node driver. This
// preserves embedded NULs; integers remain decimal strings and blobs hex.
export function readCells(json) {
  return JSON.parse(json).map(cell => cell.type === 'blob'
    ? { type: 'blob', value: Buffer.from(cell.hex, 'hex').toString('base64') }
    : cell);
}
export function* tableRows(database, table) {
  const dev = table.name === 'oa_tokens' ? devMintedTokenIds(database) : undefined, id = table.columns.indexOf('id');
  for (const row of database.prepare(readStatement(table).sql).iterate()) {
    const cells = readCells(row.cells);
    if (!dev?.has(cells[id]?.value)) yield cells;
  }
}
