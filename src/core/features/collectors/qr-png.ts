type Matrix = { size: number; get(row: number, column: number): number }

function join(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}

function word(value: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return bytes
}

function chunk(type: string, data: Uint8Array) {
  const body = join([new TextEncoder().encode(type), data])
  let crc = 0xffffffff
  for (const byte of body) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return join([word(data.length), body, word((crc ^ 0xffffffff) >>> 0)])
}

// A zlib stream with stored DEFLATE blocks needs neither Node zlib nor canvas.
function deflateStored(data: Uint8Array) {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])]
  for (let offset = 0; offset < data.length; offset += 65535) {
    const block = data.subarray(offset, offset + 65535)
    const length = block.length, inverse = length ^ 0xffff
    blocks.push(new Uint8Array([offset + length === data.length ? 1 : 0, length & 255, length >>> 8, inverse & 255, inverse >>> 8]), block)
  }
  let a = 1, b = 0
  for (const byte of data) { a = (a + byte) % 65521; b = (b + a) % 65521 }
  return join([...blocks, word(((b << 16) | a) >>> 0)])
}

function text(keyword: string, value: string) {
  // iTXt stores the source label losslessly, including non-Latin names.
  return chunk('iTXt', new TextEncoder().encode(`${keyword}\0\0\0\0\0${value}`))
}

export function qrPng(matrix: Matrix, label: string, url: string): Uint8Array<ArrayBuffer> {
  const margin = 4, scale = 8
  const rowBytes = matrix.size + margin * 2
  const side = rowBytes * scale
  const pixels = new Uint8Array((rowBytes + 1) * side)
  for (let y = 0; y < side; y++) {
    const start = y * (rowBytes + 1)
    pixels.fill(255, start + 1, start + rowBytes + 1)
    const row = Math.floor(y / scale) - margin
    if (row < 0 || row >= matrix.size) continue
    for (let x = 0; x < matrix.size; x++) if (matrix.get(row, x)) pixels[start + 1 + margin + x] = 0
  }
  const header = join([word(side), word(side), new Uint8Array([1, 0, 0, 0, 0])])
  return join([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), text('Source', label), text('URL', url),
    chunk('IDAT', deflateStored(pixels)), chunk('IEND', new Uint8Array()),
  ])
}
