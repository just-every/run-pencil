export type SqlToken = { word: string; start: number; end: number; depth: number }

/** Lexical boundaries only: quoted text and comments cannot become keywords. */
export function sqlTokens(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let depth = 0
  for (let i = 0; i < sql.length;) {
    if (/\s/.test(sql[i])) { i++; continue }
    if (sql.startsWith('--', i)) { const end = sql.indexOf('\n', i + 2); i = end < 0 ? sql.length : end + 1; continue }
    if (sql.startsWith('/*', i)) { const end = sql.indexOf('*/', i + 2); if (end < 0) throw new Error('Unclosed SQL comment'); i = end + 2; continue }
    const start = i
    let quoted = false
    if ("'\"`[".includes(sql[i])) {
      const end = sql[i] === '[' ? ']' : sql[i]
      let closed = false
      for (i++; i < sql.length; i++) {
        if (sql[i] !== end) continue
        if (end !== ']' && sql[i + 1] === end) { i++; continue }
        i++; closed = true; break
      }
      if (!closed) throw new Error('Unclosed SQL quote')
      quoted = true
    } else if (':@$?'.includes(sql[i])) {
      i++; while (i < sql.length && /[A-Za-z_0-9$]/.test(sql[i])) i++
    } else if (/[A-Za-z_0-9]/.test(sql[i])) {
      i++; while (i < sql.length && /[A-Za-z_0-9$]/.test(sql[i])) i++
    } else i++
    const raw = sql.slice(start, i)
    if (raw === ')' && --depth < 0) throw new Error('Unbalanced SQL parentheses')
    tokens.push({ word: quoted ? raw : raw.toUpperCase(), start, end: i, depth })
    if (raw === '(') depth++
  }
  if (depth !== 0) throw new Error('Unbalanced SQL parentheses')
  return tokens
}

export const outerTokens = (sql: string) => sqlTokens(sql).filter(token => token.depth === 0)
export const normalizedSql = (sql: string) => sqlTokens(sql).map(({ word }) => {
  if (/^["`[]/.test(word)) return word.slice(1, -1).replaceAll(word[0] + word[0], word[0]).toUpperCase()
  return word
}).join(' ')
export function commaTerms(sql: string): string[] {
  const commas = outerTokens(sql).filter(token => token.word === ',')
  let start = 0
  return [...commas.map(comma => { const term = sql.slice(start, comma.start); start = comma.end; return term }), sql.slice(start)]
}
