// Admission measures JavaScript UTF-16 units. SQLite length(text) counts Unicode
// code points and stops at NUL, so inspect UTF-8 leading bytes when needed.
export function sqlTextWithin(value: string, limit: number) {
  const blob = `CAST(${value} AS BLOB)`
  const lead = 'hex(substr(data,position,1))'
  return `(CASE WHEN length(${blob}) <= ${limit} THEN 1
    WHEN instr(${blob},x'00') = 0 AND 2*length(${value}) <= ${limit} THEN 1
    WHEN instr(${blob},x'00') = 0 AND length(${value}) > ${limit} THEN 0
    WHEN instr(${blob},x'00') = 0 AND ${value} NOT GLOB '*[𐀀-􏿿]*' THEN length(${value}) <= ${limit}
    ELSE (WITH RECURSIVE text_bytes(data) AS MATERIALIZED (SELECT ${blob}), units(position,total) AS (VALUES(1,0) UNION ALL
      SELECT position + CASE WHEN ${lead} < '80' THEN 1 WHEN ${lead} < 'E0' THEN 2 WHEN ${lead} < 'F0' THEN 3 ELSE 4 END,
        total + CASE WHEN ${lead} >= 'F0' THEN 2 ELSE 1 END
      FROM units,text_bytes WHERE position <= length(data) AND total <= ${limit})
    SELECT total <= ${limit} FROM units ORDER BY position DESC LIMIT 1) END)`
}
export function sqlEmail(value: string) {
  const blob = `CAST(${value} AS BLOB)`, at = `instr(${blob},x'40')`
  const whitespace = [9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279]
  return `${at} > 1 AND instr(substr(${blob},${at}+1),x'40') = 0
    AND instr(substr(${blob},${at}+2,max(0,length(${blob})-${at}-2)),x'2e') > 0
    AND ${whitespace.map(code=>`instr(${blob},CAST(char(${code}) AS BLOB)) = 0`).join(' AND ')}`
}
export function retainedTextValid(type: string, value: unknown): value is string {
  return typeof value === 'string' && value.length <= (type === 'long_text' ? 5000 : 200)
    && (type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}
