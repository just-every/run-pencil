/** Check marker framing, dimensions and scan structure before accepting JPEG bytes. */
export function jpegStructure(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216) return false
  const word = (at: number) => (bytes[at] << 8) | bytes[at + 1]
  const frames = new Set([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207])
  let offset = 2, frame = false, scan = false, entropy = false
  while (offset < bytes.length) {
    if (bytes[offset++] !== 255) return false
    while (bytes[offset] === 255) offset++
    const marker = bytes[offset++]
    if (marker === 217) return offset === bytes.length && frame && scan && entropy
    if (marker === 0 || marker === 216 || (marker >= 208 && marker <= 215) || offset + 2 > bytes.length) return false
    const size = word(offset)
    if (size < 2 || offset + size > bytes.length) return false
    if (frames.has(marker)) {
      const components = bytes[offset + 7]
      if (size < 11 || !word(offset + 3) || !word(offset + 5) || !components || components > 4 || size !== 8 + 3 * components) return false
      frame = true
    }
    if (marker === 218) {
      const components = bytes[offset + 2]
      if (!frame || size < 8 || !components || components > 4 || size !== 6 + 2 * components) return false
      scan = true
      offset += size
      // Entropy data ends at an unstuffed, non-restart marker. Progressive
      // images may then introduce another table or scan before the final EOI.
      while (offset < bytes.length) {
        if (bytes[offset] !== 255) { entropy = true; offset++; continue }
        const next = bytes[offset + 1]
        if (next === 0 || (next >= 208 && next <= 215)) { entropy = true; offset += 2; continue }
        break
      }
    } else offset += size
  }
  return false
}
