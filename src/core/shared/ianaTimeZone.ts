import names from './timeZoneNames.json'

// Current IANA names and ICU's stable aliases come from CLDR; never use the
// runtime's resolvedOptions spelling as the stored identifier.
const canonicalNames = new Map<string, string>()
for (const [canonical, aliases] of Object.entries(names)) {
  for (const name of [canonical, ...aliases.split(' ')]) canonicalNames.set(name.toLowerCase(), canonical)
}

export const timeZones = Object.keys(names)

export function canonicalTimeZone(input: string) {
  const value = input.trim()
  if (!/^[A-Za-z0-9_+./-]+$/.test(value)) return undefined
  const name = value.toLowerCase()
  if (name !== 'utc' && !name.includes('/')) return undefined
  return canonicalNames.get(name)
}
