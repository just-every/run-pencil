// CLDR's iana attribute names current IANA identifiers; alias[0] is ICU's
// deliberately stable spelling. Regenerate this data when adopting newer tzdb.
import { writeFile } from 'node:fs/promises'

const source = 'https://raw.githubusercontent.com/unicode-org/cldr/b5a68e61ac365706856ea8796585783579c9a3ff/common/bcp47/timezone.xml'
const response = await fetch(source)
if (!response.ok) throw new Error(`CLDR time-zone download failed: ${response.status}`)
const xml = await response.text()
const names = {}
for (const [element] of xml.matchAll(/<type\s[^>]+\/>/g)) {
  const attributes = Object.fromEntries([...element.matchAll(/([a-z]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))
  if (!attributes.alias || attributes.name === 'unk') continue
  const aliases = attributes.alias.split(' ')
  let canonical = attributes.iana ?? aliases[0]
  if (canonical === 'Etc/UTC' || canonical === 'Etc/GMT') canonical = 'UTC'
  if (canonical !== 'UTC' && !canonical.includes('/')) continue
  names[canonical] = [...new Set([...(names[canonical]?.split(' ') ?? []), ...aliases])].join(' ')
}
if (!names['Asia/Kathmandu'] || !names['Europe/Kyiv']) throw new Error('CLDR time-zone data is incomplete')
const sorted = Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b, 'en')))
await writeFile(new URL('../src/core/shared/timeZoneNames.json', import.meta.url), JSON.stringify(sorted, null, 2) + '\n')
console.log(`Updated ${Object.keys(sorted).length} time-zone names from ${source}`)
