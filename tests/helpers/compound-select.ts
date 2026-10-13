import { normalizedSql, outerTokens, sqlTokens } from './sql-tokens.ts'
import { compoundColumns, compoundOrder } from './compound-order.ts'

/** Fence UNION ALL groups without moving rows out of SQL. Other set operators,
 * wildcard projections and schema-dependent collations remain native SQL: a
 * lexical transform cannot safely infer their result metadata or comparisons. */
export function boundedCompoundSelect(sql: string, maxTerms = 5, maxBytes = 90_000): string {
  if (!Number.isSafeInteger(maxTerms) || maxTerms < 2) throw new Error('At least two compound terms must fit')
  const bytes = (value: string) => new TextEncoder().encode(value).length
  const checkSize = (value: string) => { if (bytes(value) > maxBytes) throw new Error('SQL query exceeds the D1 byte budget'); return value }
  checkSize(sql)
  const tokens = outerTokens(sql)
  const firstSelect = tokens.find(token => token.word === 'SELECT')
  if (!firstSelect || !['SELECT', 'WITH'].includes(tokens[0]?.word)) return sql
  const operators = tokens.filter(token => ['UNION', 'INTERSECT', 'EXCEPT'].includes(token.word))
  if (operators.length < maxTerms) return sql
  const suffixToken = tokens.find((token, i) => token.start > operators.at(-1)!.start &&
    (token.word === 'LIMIT' || (token.word === 'ORDER' && tokens[i + 1]?.word === 'BY')))
  const end = suffixToken?.start ?? sql.length
  const prefix = sql.slice(0, firstSelect.start)
  const suffix = sql.slice(end)
  const terms: string[] = []
  const joins: string[] = []
  let start = firstSelect.start
  for (const operator of operators) {
    const next = tokens[tokens.indexOf(operator) + 1]
    const operatorEnd = operator.word === 'UNION' && next?.word === 'ALL' ? next.end : operator.end
    terms.push(sql.slice(start, operator.start).trim())
    joins.push(sql.slice(operator.start, operatorEnd))
    start = operatorEnd
  }
  terms.push(sql.slice(start, end).trim())
  if (joins.some(join => normalizedSql(join) !== 'UNION ALL') || terms.some(term => outerTokens(term)[0]?.word !== 'SELECT')) return sql
  const columns = compoundColumns(terms)
  const names = columns[0].map(column => column.name)
  if (new Set(names.map(name => name.toUpperCase())).size !== names.length ||
    columns.some(columns => columns.length !== names.length || columns.some(column => !knownCollation(column.expression)))) return sql
  const order = compoundOrder(terms, suffix)
  if (order === undefined) return sql
  let grouped = terms[0], count = 1
  for (let i = 1; i < terms.length; i++) {
    // OFFSET prevents SQLite from flattening the bounded prefix back into the
    // outer compound. The negative LIMIT and zero OFFSET retain every row.
    if (count === maxTerms) { grouped = `SELECT * FROM (${grouped}\nLIMIT -1 OFFSET 0)`; count = 1 }
    grouped = checkSize(`${grouped}\n${joins[i - 1]}\n${terms[i]}`)
    count++
  }
  return checkSize(`${prefix}${grouped}\n${order}`)
}

function knownCollation(expression: string): boolean {
  const tokens = sqlTokens(expression), outer = tokens.filter(token => token.depth === 0)
  // Functions do not inherit their arguments' collations. Nested COLLATE,
  // scalar subqueries and CAST need expression analysis beyond these helpers.
  if (tokens.some(token => ['SELECT', 'CAST'].includes(token.word) || (token.word === 'COLLATE' && token.depth > 0))) return false
  if (outer.some(token => token.word === 'COLLATE')) return true
  if (outer[1]?.word === '(' && outer.at(-1)?.word === ')' && /^[A-Z_][A-Z_0-9]*$/.test(outer[0]?.word)) return true
  return tokens.every(token => /^(?:\d+(?:\.\d+)?|'.*'|[()+*/%|&~<>=!.,-]|NULL|TRUE|FALSE)$/s.test(token.word))
}
