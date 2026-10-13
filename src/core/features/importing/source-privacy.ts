import { forbiddenColumn } from './model'

const normalize = (name: string) => name.trim().toLocaleLowerCase('en-US')
export const sourceNames = (field: Record<string, unknown>): string[] => [field.id, field.ref, field.title].filter(value => value != null).map(String).filter(value => value.trim() !== '')

/** Source identities and their display aliases are inspected before mapping.
 * This set is request-local: hidden names and values never enter the safe plan. */
export function forbiddenSources(definition: Record<string, unknown>): Set<string> {
  const names = new Set((definition.hidden as string[] | undefined ?? []).map(normalize))
  const fields: Record<string, unknown>[] = []
  const visit = (values: unknown) => {
    if (!Array.isArray(values)) return
    for (const value of values) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const field = value as Record<string, unknown>
      fields.push(field)
      visit((field.properties as Record<string, unknown> | undefined)?.fields)
    }
  }
  visit(definition.fields)
  // Close over aliases, including ambiguous titles shared with a hidden field.
  let changed = true
  while (changed) {
    changed = false
    for (const field of fields) {
      const aliases = sourceNames(field)
      if (field.type !== 'hidden' && !aliases.some(name => names.has(normalize(name)) || forbiddenColumn(name))) continue
      for (const name of aliases) if (!names.has(normalize(name))) { names.add(normalize(name)); changed = true }
    }
  }
  return names
}

export const forbiddenSource = (name: string, names: Set<string>) => names.has(normalize(name)) || forbiddenColumn(name)
