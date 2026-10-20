import unicodeFold from './unicode-search-fold.json'

const mapping: Record<string, string> = unicodeFold

/** Unicode 16.0 full case folding, followed by canonical composition. */
export function foldSearch(value: string) {
  return [...value.normalize('NFD')].map(char => mapping[char] ?? char).join('').normalize('NFC')
}

/** Map canonical/expanding matches back to the retained spelling for highlights. */
export function searchRanges(text: string, phrase: string) {
  const needle = foldSearch(phrase)
  if (!needle) return []
  let folded = ''
  const offsets: Array<{ start: number; end: number }> = []
  for (const { segment, index } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    const value = foldSearch(segment)
    folded += value
    for (let i = 0; i < value.length; i++) offsets.push({ start: index, end: index + segment.length })
  }
  const ranges: Array<{ start: number; end: number }> = []
  let position = 0
  while ((position = folded.indexOf(needle, position)) >= 0) {
    const start = offsets[position].start, end = offsets[position + needle.length - 1].end
    const previous = ranges.at(-1)
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end)
    else ranges.push({ start, end })
    position += needle.length
  }
  return ranges
}
