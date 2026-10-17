export type RecallToken = { key: string; start: number; end: number }
const keyPattern = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

export function isRecallKey(value: unknown): value is string {
  return typeof value === 'string' && keyPattern.test(value)
}
export function recallKey(settings: Record<string, unknown> | null | undefined): string | undefined {
  return isRecallKey(settings?.recallKey) ? settings.recallKey : undefined
}
export function withoutRecallKey(settings: Record<string, unknown>): Record<string, unknown> {
  const { recallKey: _key, ...specific } = settings
  return specific
}

/** Only complete, valid {{key}} tokens are templates. Other braces stay literal. */
export function recallTokens(text: string): RecallToken[] {
  const tokens: RecallToken[] = []
  const pattern = /\{\{\s*([A-Za-z][A-Za-z0-9_]{0,39})\s*\}\}/g
  for (const match of text.matchAll(pattern)) {
    const start = match.index, end = start + match[0].length
    if (text[start - 1] === '{' || text[end] === '}') continue
    tokens.push({ key: match[1], start, end })
  }
  return tokens
}

/** A single source pass: inserted respondent text is never interpreted again. */
export function replaceRecall(text: string, resolve: (key: string) => string): string {
  let position = 0, rendered = ''
  for (const token of recallTokens(text)) {
    rendered += text.slice(position, token.start) + resolve(token.key)
    position = token.end
  }
  return rendered + text.slice(position)
}
