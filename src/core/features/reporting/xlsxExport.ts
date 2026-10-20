import { ValidationError } from '../../shared/errors'
import { centralDirectory, crc32, dataDescriptor, fixedEntry, localHeader, zipLimit, type ZipEntry } from './zip'

/** XLSX (LEDG-005): sheet one holds the CSV columns and values, sheet two the question metadata. */
const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const worksheetType = `${relationships}/worksheet`
const fixed: Array<[string, string]> = [
  ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
  ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${main}" xmlns:r="${relationships}"><sheets><sheet name="Responses" sheetId="1" r:id="rId1"/><sheet name="Questions" sheetId="2" r:id="rId2"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${worksheetType}" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${worksheetType}" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${relationships}/styles" Target="styles.xml"/></Relationships>`],
  ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="${main}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
]
const sheetStart = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${main}"><sheetData>`
const sheetEnd = '</sheetData></worksheet>'
const encoder = new TextEncoder()
/** Excel refuses longer cells; such an export is refused, never truncated. */
export const xlsxCellLimit = 32767
export const metadataHeader = ['revision_id', 'revision_number', 'step_id', 'position', 'question_type', 'label', 'choice_id', 'choice_value', 'choice_label', 'sav_variable', 'sav_code']
export type XlsxState = { crc: number; size: number }

function layout() {
  let offset = 0
  const entries: ZipEntry[] = [], bytes: Uint8Array[] = []
  for (const [name, content] of fixed) {
    const written = fixedEntry(name, content, offset)
    entries.push(written.entry); bytes.push(...written.bytes)
    offset += written.bytes.reduce((sum, part) => sum + part.length, 0)
  }
  return { entries, bytes, sheetOffset: offset }
}
const column = (index: number) => { let name = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name; return name }
/** Text is always an inline string, never a formula, so a leading = + - or @ is never evaluated. */
function text(value: string) {
  return value.replace(/_x([0-9A-Fa-f]{4})_/g, '_x005F_x$1_')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, char => `_x${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}_`)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
export function xlsxRow(values: Array<string | number | null | undefined>, row: number) {
  return `<row r="${row}">${values.map((value, index) => {
    const reference = `${column(index)}${row}`
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`
    const string = String(value ?? '')
    if (string.length > xlsxCellLimit) throw new ValidationError(`A value in column ${column(index)} is longer than Excel's ${xlsxCellLimit}-character cell limit. Export CSV or JSON for this selection.`)
    return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${text(string)}</t></is></c>`
  }).join('')}</row>`
}
/** The first part: the fixed parts, the streamed sheet's local header and its opening rows. */
export function xlsxStart(header: string[]) {
  const { bytes } = layout()
  const data = encoder.encode(sheetStart + xlsxRow(header, 1))
  return { prefix: [...bytes, localHeader('xl/worksheets/sheet1.xml', true)], data }
}
export function xlsxContinue(state: XlsxState, data: Uint8Array): XlsxState {
  const next = { crc: crc32(data, state.crc), size: state.size + data.length }
  if (layout().sheetOffset + next.size > zipLimit) throw new ValidationError('This XLSX export exceeds the 4 GiB ZIP limit. Narrow the selected responses and export again.')
  return next
}
/** The last part closes sheet one, streams the question metadata as sheet two and writes the directory. */
export async function* xlsxFinish(state: XlsxState, metadata: Iterable<Array<string | number>>) {
  const end = encoder.encode(sheetEnd)
  const sheet = xlsxContinue(state, end)
  yield end
  yield dataDescriptor(sheet.crc, sheet.size)
  const { entries, sheetOffset } = layout()
  const sheetHeader = localHeader('xl/worksheets/sheet1.xml', true).length
  entries.push({ name: 'xl/worksheets/sheet1.xml', crc: sheet.crc, size: sheet.size, offset: sheetOffset, streamed: true })
  const questionsOffset = sheetOffset + sheetHeader + sheet.size + 16
  const questionsHeader = localHeader('xl/worksheets/sheet2.xml', true)
  yield questionsHeader
  let questions: XlsxState = { crc: 0, size: 0 }
  const emit = (content: string) => { const bytes = encoder.encode(content); questions = { crc: crc32(bytes, questions.crc), size: questions.size + bytes.length }; return bytes }
  yield emit(sheetStart + xlsxRow(metadataHeader, 1))
  let row = 1
  for (const values of metadata) yield emit(xlsxRow(values, ++row))
  yield emit(sheetEnd)
  if (questionsOffset + questions.size > zipLimit) throw new ValidationError('This XLSX export exceeds the 4 GiB ZIP limit. Narrow the selected responses and export again.')
  yield dataDescriptor(questions.crc, questions.size)
  entries.push({ name: 'xl/worksheets/sheet2.xml', crc: questions.crc, size: questions.size, offset: questionsOffset, streamed: true })
  yield* centralDirectory(entries, questionsOffset + questionsHeader.length + questions.size + 16)
}
