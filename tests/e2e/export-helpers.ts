import type { Download } from '@playwright/test'
export async function downloadedText(download: Download) {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('The export download could not be read.')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}
export function csvRows(source: string) {
  const rows: string[][] = [], row: string[] = []
  let field = '', quoted = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index++ }
      else quoted = !quoted
    } else if (!quoted && char === ',') { row.push(field); field = '' }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index++
      row.push(field); rows.push([...row]); row.length = 0; field = ''
    } else field += char
  }
  if (quoted) throw new Error('The CSV export contains an unclosed field.')
  row.push(field); rows.push([...row])
  return rows
}
