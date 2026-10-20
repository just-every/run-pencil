/** A store-only ZIP writer whose streamed entry can span export parts: only its CRC and size carry over. */
const table = (() => {
  const values = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; values[n] = c >>> 0 }
  return values
})()
/** Continue a CRC-32 from `crc` (the finished value of the bytes before `bytes`). */
export function crc32(bytes: Uint8Array, crc = 0) {
  let c = (crc ^ 0xffffffff) >>> 0
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
export type ZipEntry = { name: string; crc: number; size: number; offset: number; streamed: boolean }
const encoder = new TextEncoder()
// 1980-01-01 00:00 in DOS time: entries carry no clock so identical selections give identical archives.
const dosTime = 0, dosDate = 0x21
function record(size: number, write: (view: DataView, bytes: Uint8Array) => void) {
  const bytes = new Uint8Array(size)
  write(new DataView(bytes.buffer), bytes)
  return bytes
}
export function localHeader(name: string, streamed: boolean, crc = 0, size = 0) {
  const encoded = encoder.encode(name)
  return record(30 + encoded.length, (view, bytes) => {
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, streamed ? 0x0808 : 0x0800, true); view.setUint16(8, 0, true)
    view.setUint16(10, dosTime, true); view.setUint16(12, dosDate, true)
    view.setUint32(14, streamed ? 0 : crc, true); view.setUint32(18, streamed ? 0 : size, true); view.setUint32(22, streamed ? 0 : size, true)
    view.setUint16(26, encoded.length, true); view.setUint16(28, 0, true); bytes.set(encoded, 30)
  })
}
export function dataDescriptor(crc: number, size: number) {
  return record(16, view => { view.setUint32(0, 0x08074b50, true); view.setUint32(4, crc, true); view.setUint32(8, size, true); view.setUint32(12, size, true) })
}
export function centralDirectory(entries: ZipEntry[], offset: number) {
  const parts = entries.map(entry => {
    const encoded = encoder.encode(entry.name)
    return record(46 + encoded.length, (view, bytes) => {
      view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, entry.streamed ? 0x0808 : 0x0800, true); view.setUint16(10, 0, true)
      view.setUint16(12, dosTime, true); view.setUint16(14, dosDate, true); view.setUint32(16, entry.crc, true); view.setUint32(20, entry.size, true); view.setUint32(24, entry.size, true)
      view.setUint16(28, encoded.length, true); view.setUint32(42, entry.offset, true); bytes.set(encoded, 46)
    })
  })
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const end = record(22, view => {
    view.setUint32(0, 0x06054b50, true); view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true)
    view.setUint32(12, size, true); view.setUint32(16, offset, true)
  })
  return [...parts, end]
}
/** A fixed entry written whole, with its offset in the archive. */
export function fixedEntry(name: string, content: string, offset: number) {
  const bytes = encoder.encode(content)
  const entry: ZipEntry = { name, crc: crc32(bytes), size: bytes.length, offset, streamed: false }
  return { entry, bytes: [localHeader(name, false, entry.crc, entry.size), bytes] }
}
/** ZIP32 offsets and sizes stop at 4 GiB; a larger archive is refused rather than corrupted. */
export const zipLimit = 0xffffffff - 64 * 1024 * 1024
