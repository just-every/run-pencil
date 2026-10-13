import { readFile } from 'node:fs/promises'

export function evaluateProfile(profile, ids, mode = 'first-release') {
  if (!['first-release', 'full'].includes(mode)) throw new Error(`Unknown contract profile: ${mode}`)
  if (!profile || profile.schemaVersion !== 1 || profile.id !== 'first-release' ||
      !Array.isArray(profile.deferredFamilies) || !Array.isArray(profile.deferredClauses)) throw new Error('Invalid first-release profile schema.')
  if (Object.keys(profile).some(key => !['schemaVersion', 'id', 'authority', 'deferredFamilies', 'deferredClauses'].includes(key))) throw new Error('Clause exclusions and baseline waivers are not supported by this profile.')
  if (typeof profile.authority !== 'string' || !profile.authority.trim()) throw new Error('Profile authority is required.')
  const selected = new Set()
  const add = id => {
    if (id.startsWith('BASE-')) throw new Error('Baseline waivers are not supported by this profile.')
    if (!ids.includes(id)) throw new Error(`Unknown deferred clause: ${id}`)
    if (selected.has(id)) throw new Error(`Repeated deferred clause: ${id}`)
    selected.add(id)
  }
  const families = new Set()
  for (const family of profile.deferredFamilies) {
    if (typeof family !== 'string' || !/^[A-Z][A-Z0-9]*$/.test(family) || families.has(family)) throw new Error('Invalid or repeated deferred family.')
    families.add(family)
    const matches = ids.filter(id => id.startsWith(`${family}-`))
    if (!matches.length) throw new Error(`Unknown deferred family: ${family}`)
    for (const id of matches) add(id)
  }
  for (const id of profile.deferredClauses) {
    if (typeof id !== 'string' || !/^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}$/.test(id)) throw new Error('Invalid deferred clause.')
    add(id)
  }
  return mode === 'full' ? new Set() : selected
}

export async function readProfile(root, ids, mode) {
  return evaluateProfile(JSON.parse(await readFile(new URL('../contract-profile.json', import.meta.url), 'utf8')), ids, mode)
}
