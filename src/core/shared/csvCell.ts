/** One quoted CSV cell. Quoting alone does not stop spreadsheet formulas in written text; numbers stay numeric. */
export function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '')
  const safe = typeof value === 'string' && (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}
