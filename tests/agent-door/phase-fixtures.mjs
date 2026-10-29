import { randomUUID } from 'node:crypto'

// Each policy round creates ordinary, independent native records. These values
// are only names; no application table, credential or signed claim is written.
export default async function phaseFixtures() {
  return { values: { slug: `door-${randomUUID()}`, copySlug: `door-copy-${randomUUID()}` } }
}
