import { Buffer } from 'node:buffer';
import { failure } from './deployment-data-errors.mjs';
import { quote } from './deployment-data-sql.mjs';
import { exclusions, excludedCaptureTables } from './deployment-data-policy.mjs';
import { primaryQuery, queryLimits } from './deployment-data-provider.mjs';

const valueExpression = (table, column) => {
  const replacement = exclusions[table.name]?.[column];
  if (!replacement) return quote(column);
  if (replacement.type === 'null') return 'NULL';
  if (replacement.type === 'integer') return replacement.value;
  if (replacement.type === 'blob') return "X''";
  return "''";
};
export function pageStatement(table, after) {
  const values = table.columns.map(column => valueExpression(table, column));
  const bytes = values.map(value => `coalesce(length(CAST(CASE typeof(${value}) WHEN 'text' THEN json_quote(${value}) ELSE ${value} END AS BLOB)),0)`).join('+');
  const cells = values.flatMap((value, index) => [
    `typeof(${value}) AS t${index}`,
    `CASE typeof(${value}) WHEN 'integer' THEN CAST(${value} AS TEXT) WHEN 'blob' THEN hex(substr(${value},1,65536)) WHEN 'text' THEN json_quote(${value}) ELSE ${value} END AS v${index}`,
    `CASE typeof(${value}) WHEN 'blob' THEN length(${value}) ELSE 0 END AS n${index}`,
  ]);
  // Window only row identifiers and byte counts. Carrying full values through
  // the window would materialize up to 512 maximum-size rows inside D1 before
  // applying the result budget. Fetch values only for the selected identifiers.
  return { sql: `WITH page AS (SELECT rowid AS archive_cursor,${bytes} AS archive_row_bytes FROM ${quote(table.name)} ${after === undefined ? '' : 'WHERE rowid > CAST(? AS INTEGER)'} ORDER BY rowid LIMIT ${queryLimits.pageRows}), bounded AS (SELECT archive_cursor,sum(archive_row_bytes) OVER (ORDER BY archive_cursor) AS archive_bytes,row_number() OVER (ORDER BY archive_cursor) AS archive_ordinal FROM page) SELECT CAST(archive_cursor AS TEXT) AS cursor,${cells.join(',')} FROM ${quote(table.name)} JOIN bounded ON rowid=archive_cursor WHERE archive_bytes<=${queryLimits.pageBytes} OR archive_ordinal=1 ORDER BY archive_cursor`, params: after === undefined ? [] : [after] };
}
export async function* remoteRows(query, table) {
  if (excludedCaptureTables.has(table.name)) return;
  let after;
  for (;;) {
    const [{ results }] = await primaryQuery(query, [pageStatement(table, after)]);
    if (!results.length) return;
    for (const record of results) {
      if (!/^-?\d+$/.test(record.cursor) || (after !== undefined && BigInt(record.cursor) <= BigInt(after))) throw failure('PROVIDER_FAILURE', 'D1 returned an invalid page cursor.');
      const row = [];
      for (const [index, column] of table.columns.entries()) {
        const type = record[`t${index}`], value = record[`v${index}`];
        if (type === 'null') row.push({ type });
        else if (type === 'blob') {
          let hex = value;
          for (let offset = 65536; offset < record[`n${index}`]; offset += 65536) {
            const [{ results: chunk }] = await primaryQuery(query, [{ sql: `SELECT hex(substr(${quote(column)},?,65536)) AS chunk FROM ${quote(table.name)} WHERE rowid=CAST(? AS INTEGER)`, params: [offset + 1, record.cursor] }]);
            if (chunk.length !== 1 || typeof chunk[0].chunk !== 'string') throw failure('PROVIDER_FAILURE', 'D1 returned invalid binary data.');
            hex += chunk[0].chunk;
          }
          if (typeof hex !== 'string' || !/^(?:[a-f\d]{2})*$/i.test(hex) || hex.length !== record[`n${index}`] * 2) throw failure('PROVIDER_FAILURE', 'D1 returned invalid binary data.');
          row.push({ type, value: Buffer.from(hex, 'hex').toString('base64') });
        } else if (type === 'text') {
          let text;
          try { text = JSON.parse(value); } catch { throw failure('PROVIDER_FAILURE', 'D1 returned invalid text data.'); }
          if (typeof text !== 'string') throw failure('PROVIDER_FAILURE', 'D1 returned invalid text data.');
          row.push({ type, value: text });
        } else row.push({ type, value });
      }
      after = record.cursor; yield row;
    }
  }
}
