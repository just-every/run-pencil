import { commaTerms, normalizedSql, outerTokens, sqlTokens } from './sql-tokens.ts'

const identifier = (value: string) => /^(?:[A-Za-z_][A-Za-z_0-9$]*|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|'(?:[^']|'')*')$/.test(value)
const unquote = (value: string) => /^["`'[]/.test(value) ? value.slice(1, -1).replaceAll(value[0] + value[0], value[0]) : value

/** Retain source expressions and aliases before nesting hides them from SQLite. */
export function compoundColumns(terms: string[]) {
  return terms.map(term => {
    const tokens = outerTokens(term), select = tokens.find(token => token.word === 'SELECT')!
    const startToken = tokens[tokens.indexOf(select) + 1]
    const start = startToken?.word === 'DISTINCT' || startToken?.word === 'ALL' ? startToken.end : select.end
    const end = tokens.find(token => ['FROM', 'WHERE', 'GROUP', 'HAVING', 'WINDOW', ';'].includes(token.word))?.start ?? term.length
    return commaTerms(term.slice(start, end)).map(projection => {
      const tokens = outerTokens(projection), explicit = tokens.find(token => token.word === 'AS')
      const last = tokens.at(-1), previous = tokens.at(-2)
      const implicit = !explicit && last && previous && identifier(last.word) &&
        !['COLLATE', '.', '+', '-', '*', '/', '%', '|', '&', '=', '<', '>', 'IS', 'NOT', 'AND', 'OR', 'WHEN', 'THEN', 'ELSE'].includes(previous.word) &&
        last.start > previous.end ? last : undefined
      const aliasToken = explicit ? tokens[tokens.indexOf(explicit) + 1] : implicit
      const alias = aliasToken ? projection.slice(aliasToken.start, aliasToken.end) : ''
      const expression = projection.slice(0, explicit?.start ?? implicit?.start ?? projection.length).trim()
      const expressionTokens = sqlTokens(expression)
      const collateIndex = expressionTokens.findIndex(token => token.word === 'COLLATE')
      const collation = collateIndex < 0 ? '' : expressionTokens[collateIndex + 1]?.word ?? ''
      const column = expressionTokens.at(-1)
      const simpleName = expressionTokens.length === 1 || (expressionTokens.length === 3 && expressionTokens[1].word === '.')
      return { expression, expressions: [expression, ...(alias ? [alias, unquote(alias)] : [])], collation,
        name: alias ? unquote(alias) : simpleName && column && !column.word.startsWith("'") && identifier(column.word) ? unquote(expression.slice(column.start, column.end)) : expression }
    })
  })
}

/** SQLite compound ORDER BY expressions identify a result column. Resolve that
 * column before nesting, so expressions and aliases in any original arm survive. */
export function compoundOrder(terms: string[], suffix: string): string | undefined {
  const tokens = outerTokens(suffix)
  if (tokens[0]?.word !== 'ORDER' || tokens[1]?.word !== 'BY') return suffix
  const end = tokens.find(token => token.word === 'LIMIT' || token.word === ';')?.start ?? suffix.length
  const projections = compoundColumns(terms)
  let unresolved = false
  const order = commaTerms(suffix.slice(tokens[1].end, end)).map(term => {
    const modifier = outerTokens(term).find(token => ['COLLATE', 'ASC', 'DESC', 'NULLS'].includes(token.word))
    const expression = term.slice(0, modifier?.start ?? term.length), normalized = normalizedSql(expression)
    if (/^(?:\+ )?\d+$/.test(normalized)) {
      const index = Number(normalized.replaceAll(' ', '')) - 1
      const inherited = projections.find(columns => columns[index]?.collation)?.[index].collation
      return `${expression} ${inherited && modifier?.word !== 'COLLATE' ? `COLLATE ${inherited}` : ''} ${modifier ? term.slice(modifier.start) : ''}`
    }
    for (const columns of projections) {
      const index = columns.findIndex(column => column.expressions.some(value => normalizedSql(value) === normalized))
      if (index >= 0) {
        const inherited = projections.find(columns => columns[index]?.collation)?.[index].collation
        const collation = inherited && modifier?.word !== 'COLLATE' ? `COLLATE ${inherited}` : ''
        return `${index + 1} ${collation} ${modifier ? term.slice(modifier.start) : ''}`
      }
    }
    // Leave the original query to SQLite when lexical matching is insufficient.
    unresolved = true
    return term
  })
  return unresolved ? undefined : `ORDER BY ${order.join(', ')} ${suffix.slice(end)}`
}
