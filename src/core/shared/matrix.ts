/** Matrix row IDs remain unchanged when labels or row order change. */
export type MatrixRow = { id: string; label: string }
export const matrixModes = ['single', 'multiple', 'likert5', 'likert7'] as const
export function matrixRows(settings: Record<string, unknown> | null | undefined): MatrixRow[] {
  return Array.isArray(settings?.matrixRows) ? settings.matrixRows as MatrixRow[] : []
}
export function matrixMultiple(settings: Record<string, unknown> | null | undefined) { return settings?.matrixMode === 'multiple' }
export function matrixSettingsValid(settings: Record<string, unknown>) {
  const rows = matrixRows(settings)
  return matrixModes.includes(settings.matrixMode as typeof matrixModes[number]) && rows.length > 0 && rows.length <= 50 &&
    rows.every(row => row && typeof row === 'object' && Object.keys(row).every(key => ['id', 'label'].includes(key)) && typeof row.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(row.id) && typeof row.label === 'string' && row.label.trim().length > 0 && row.label.length <= 300) &&
    new Set(rows.map(row => row.id)).size === rows.length && Object.keys(settings).every(key => ['matrixRows', 'matrixMode'].includes(key))
}
export function matrixScaleIssue(settings: Record<string, unknown>, choices: string[]) {
  const count = settings.matrixMode === 'likert5' ? 5 : settings.matrixMode === 'likert7' ? 7 : undefined
  return choices.length < 1 || count !== undefined && choices.length !== count ? 'Choose the complete shared scale for this matrix.' : undefined
}
export function matrixAnswerIssue(settings: Record<string, unknown>, choices: string[], value: unknown, required: boolean): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Answer the matrix using its available rows and scale.'
  if (new TextEncoder().encode(JSON.stringify(value)).length > 30002) return 'This matrix answer exceeds the response size limit.'
  const answer = value as Record<string, unknown>, rows = matrixRows(settings)
  if (Object.keys(answer).some(id => !rows.some(row => row.id === id))) return 'This matrix answer contains an unknown row.'
  for (const row of rows) {
    const selected = Object.hasOwn(answer, row.id) ? answer[row.id] : undefined
    if (selected === undefined || selected === null || Array.isArray(selected) && !selected.length) {
      if (required) return `Choose an answer for “${row.label}”.`
      if (selected !== undefined) return `Omit unanswered row “${row.label}”.`
      continue
    }
    if (matrixMultiple(settings) ? !Array.isArray(selected) || !selected.length || selected.some(id => typeof id !== 'string' || !choices.includes(id)) || new Set(selected).size !== selected.length : typeof selected !== 'string' || !choices.includes(selected)) return `Choose valid, distinct scale options for “${row.label}”.`
  }
}
