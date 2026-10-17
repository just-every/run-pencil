import manifest from '../../../seed.json'

export const TEXT_PATTERN_LIMIT = 256
export const TEXT_MESSAGE_LIMIT = 1000
export function textTypeLimit(type: string | null) {
  return type === 'short_text' ? manifest.limits.responses.shortTextCharactersPerAnswer : manifest.limits.responses.openTextCharactersPerAnswer
}

type Atom = { accepts: (character: string) => boolean; min: number; max: number }
type Character = { accepts: (character: string) => boolean; literal?: string }

/** A concatenation-only regex grammar. No dynamic RegExp ever receives a pattern. */
function parsePattern(pattern: string): Atom[] | undefined {
  if (!pattern.length || pattern.length > TEXT_PATTERN_LIMIT) return undefined
  let source = pattern
  if (source.startsWith('^')) source = source.slice(1)
  // An escaped dollar is a literal, not an end anchor.
  let slashes = 0
  for (let i = source.length - 2; i >= 0 && source[i] === '\\'; i--) slashes++
  if (source.endsWith('$') && slashes % 2 === 0) source = source.slice(0, -1)
  let position = 0
  const literal = (value: string): Character => ({ literal: value, accepts: character => character === value })
  const character = (): Character | undefined => {
    const value = source[position++]
    if (value === undefined) return undefined
    if (value !== '\\') return literal(value)
    const escaped = source[position++]
    if (escaped === 'd') return { accepts: value => value >= '0' && value <= '9' }
    if (escaped === 'w') return { accepts: value => /[A-Za-z0-9_]/.test(value) }
    if (escaped === 's') return { accepts: value => /\s/.test(value) }
    if (escaped === 'n') return literal('\n')
    if (escaped === 'r') return literal('\r')
    if (escaped === 't') return literal('\t')
    // Refuse backreferences, Unicode/property escapes and unknown escape syntax.
    return escaped !== undefined && '\\.^$[]{}()*+?|-'.includes(escaped) ? literal(escaped) : undefined
  }
  const atoms: Atom[] = []
  while (position < source.length) {
    let accepts: Atom['accepts']
    if (source[position] === '[') {
      position++
      const negate = source[position] === '^'
      if (negate) position++
      const members: Character[] = []
      while (position < source.length && source[position] !== ']') {
        const start = character()
        if (!start) return undefined
        if (source[position] === '-' && source[position + 1] !== ']') {
          position++
          const end = character()
          if (start.literal === undefined || end?.literal === undefined || start.literal > end.literal) return undefined
          const low = start.literal, high = end.literal
          members.push({ accepts: value => value >= low && value <= high })
        } else members.push(start)
      }
      if (source[position++] !== ']' || !members.length) return undefined
      accepts = value => members.some(member => member.accepts(value)) !== negate
    } else if (source[position] === '.') {
      position++
      accepts = value => value !== '\n' && value !== '\r' && value !== '\u2028' && value !== '\u2029'
    } else {
      if ('^$]{}()*+?|'.includes(source[position])) return undefined
      const value = character()
      if (!value) return undefined
      accepts = value.accepts
    }
    let min = 1, max = 1
    const quantifier = source[position]
    if (quantifier === '?' || quantifier === '*' || quantifier === '+') {
      position++
      min = quantifier === '+' ? 1 : 0
      max = quantifier === '?' ? 1 : Infinity
    } else if (quantifier === '{') {
      const end = source.indexOf('}', position)
      if (end < 0) return undefined
      const counts = source.slice(position + 1, end).match(/^(\d+)(?:,(\d*))?$/)
      if (!counts) return undefined
      min = Number(counts[1])
      max = counts[2] === undefined ? min : counts[2] === '' ? Infinity : Number(counts[2])
      if (!Number.isSafeInteger(min) || min > textTypeLimit('short_text') || (max !== Infinity && (!Number.isSafeInteger(max) || max > textTypeLimit('short_text'))) || max < min) return undefined
      position = end + 1
    }
    atoms.push({ accepts, min, max })
  }
  return atoms
}

/** O(pattern length × answer length), including ambiguous adjacent repetitions.
 * Each atom queries reachable offsets using prefix counts; there is no
 * backtracking and repetition counts never expand the state space.
 */
function patternMatches(atoms: Atom[], value: string) {
  let reachable = new Uint8Array(value.length + 1)
  reachable[0] = 1
  for (const atom of atoms) {
    const next = new Uint8Array(value.length + 1)
    const counts = new Uint32Array(value.length + 2)
    for (let index = 0; index <= value.length; index++) counts[index + 1] = counts[index] + reachable[index]
    let runStart = 0
    for (let end = 0; end <= value.length; end++) {
      if (end > 0 && !atom.accepts(value[end - 1])) runStart = end
      const earliest = Math.max(runStart, end - atom.max)
      const latest = end - atom.min
      if (latest >= earliest && counts[latest + 1] > counts[earliest]) next[end] = 1
    }
    reachable = next
  }
  return reachable[value.length] === 1
}

export function textSettingsIssue(type: string | null, settings: Record<string, unknown>): string | undefined {
  if (type !== 'short_text' && type !== 'long_text') return undefined
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return 'Text settings must be an object.'
  const limit = textTypeLimit(type)
  for (const key of ['minLength', 'maxLength']) {
    const value = settings[key]
    if (value !== undefined && (!Number.isInteger(value) || (value as number) < 0 || (value as number) > limit)) return `Character limits must be whole numbers from 0 to ${limit.toLocaleString('en-US')}.`
  }
  if (settings.minLength !== undefined && settings.maxLength !== undefined && (settings.minLength as number) > (settings.maxLength as number)) return 'Minimum characters cannot exceed maximum characters.'
  if (settings.validationMessage !== undefined && (typeof settings.validationMessage !== 'string' || !settings.validationMessage.trim() || settings.validationMessage.length > TEXT_MESSAGE_LIMIT)) return `Enter an error message of 1 to ${TEXT_MESSAGE_LIMIT} characters.`
  for (const key of ['inputMask', 'pattern']) {
    if (settings[key] === undefined) continue
    if (type !== 'short_text') return 'Masks and patterns are available for short text only.'
    if (typeof settings[key] !== 'string' || !(settings[key] as string).length) return 'Clear unused masks and patterns, or enter a value.'
  }
  if (typeof settings.inputMask === 'string' && settings.inputMask.length > limit) return `The mask cannot exceed ${limit} characters.`
  if (typeof settings.pattern === 'string' && !parsePattern(settings.pattern)) return `Use a pattern of at most ${TEXT_PATTERN_LIMIT} characters: literals, character classes and single-atom repetitions. Groups, alternatives, backreferences and lookaround are not supported.`
  return undefined
}

export function textSettingsValid(type: string | null, settings: Record<string, unknown>) {
  return textSettingsIssue(type, settings) === undefined
}

/** Required/optional empty-answer handling belongs to the shared answer validator. */
export function textAnswerIssue(type: string | null, settings: Record<string, unknown>, value: unknown): string | undefined {
  if (type !== 'short_text' && type !== 'long_text') return undefined
  if (!textSettingsValid(type, settings)) return 'This question has invalid text settings.'
  const message = typeof settings.validationMessage === 'string' ? settings.validationMessage : undefined
  if (typeof value !== 'string') return message ?? 'Enter a text response.'
  const min = typeof settings.minLength === 'number' ? settings.minLength : 0
  const max = typeof settings.maxLength === 'number' ? settings.maxLength : textTypeLimit(type)
  if (value.length < min) return message ?? `Enter at least ${min.toLocaleString('en-US')} characters.`
  if (value.length > max) return message ?? `Enter no more than ${max.toLocaleString('en-US')} characters.`
  if (typeof settings.inputMask === 'string') {
    const mask = settings.inputMask
    const valid = value.length === mask.length && Array.from({ length: mask.length }, (_, index) => {
      const token = mask[index], character = value[index]
      return token === '#' ? /[0-9]/.test(character) : token === '@' ? /[A-Za-z]/.test(character) : token === '*' ? /[A-Za-z0-9]/.test(character) : character === token
    }).every(Boolean)
    if (!valid) return message ?? `Use this format: ${mask} (# digit, @ letter, * letter or digit).`
  }
  if (typeof settings.pattern === 'string') {
    const pattern = parsePattern(settings.pattern)
    if (!pattern || !patternMatches(pattern, value)) return message ?? 'Enter a response matching the required pattern.'
  }
  return undefined
}
