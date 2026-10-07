import { readFile } from 'node:fs/promises'

const authorizedFamilies = ['AUD', 'ANLY', 'ACT', 'NOTIFY']

export function evaluateProfile(profile, ids, mode = 'first-release') {
  if (!['first-release', 'full'].includes(mode)) throw new Error(`Unknown contract profile: ${mode}`)
  if (profile.schemaVersion !== 1 || profile.id !== 'first-release' ||
      JSON.stringify([...profile.deferredFamilies].sort()) !== JSON.stringify([...authorizedFamilies].sort())) {
    throw new Error('The first-release profile may defer exactly AUD, ANLY, ACT and NOTIFY.')
  }
  if (Object.keys(profile).some(key => !['schemaVersion', 'id', 'authority', 'deferredFamilies'].includes(key))) {
    throw new Error('Clause exclusions and baseline waivers are not supported by this profile.')
  }
  if (typeof profile.authority !== 'string' || !profile.authority.trim()) throw new Error('Profile authority is required.')
  return new Set(mode === 'full' ? [] : ids.filter(id => authorizedFamilies.some(family => id.startsWith(`${family}-`))))
}

export async function readProfile(root, ids, mode) {
  return evaluateProfile(JSON.parse(await readFile(new URL('../contract-profile.json', import.meta.url), 'utf8')), ids, mode)
}
