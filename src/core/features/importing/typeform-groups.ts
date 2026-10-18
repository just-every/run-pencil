import type { ImportStep, ReportItem } from './model'

/** The first ordinary question owns the screen; answers retain their own IDs. */
export function mapQuestionGroup(input: {
  field: Record<string, any>
  sourceId: string
  location: string
  item: ReportItem
  steps: ImportStep[]
  report: ReportItem[]
  add: (raw: unknown, location: string) => void
}) {
  const { field, sourceId, location, item, steps, report, add } = input
  const properties = field.properties && typeof field.properties === 'object' && !Array.isArray(field.properties) ? field.properties : {}
  if (!Array.isArray(properties.fields) || !properties.fields.length) {
    item.state = 'unsupported'
    item.change = 'Group omitted'
    item.reason = 'A question group needs a fields array containing supported questions.'
    return
  }
  const start = steps.length
  properties.fields.forEach((child: unknown, index: number) => add(child, `${location}/properties/fields/${index}`))
  const members = steps.slice(start)
  if (!members.length) {
    item.state = 'unsupported'
    item.change = 'Group omitted'
    item.reason = 'No supported questions remain in this group. Its omitted fields are listed separately.'
  } else {
    members[0].groupSourceId = sourceId
    members[0].settings.screen = {
      kind: 'group', title: String(field.title ?? ''),
      ...(properties.description == null ? {} : { description: String(properties.description) }),
      questionIds: members.map(step => step.id),
    }
    item.change = 'Question group'
    item.reason = `Heading, description and ${members.length} supported questions share one screen. Each question retains its own answer identity, required state and validation.`
  }
  const omitted = (key: string, path: string) => report.push({ location: path, label: item.label, sourceType: item.sourceType, state: 'unsupported', change: 'Group property omitted', reason: `${key} has no imported native behavior.` })
  for (const key of Object.keys(properties)) if (!['description', 'fields'].includes(key)) omitted(key, `${location}/properties/${key}`)
  for (const key of Object.keys(field.validations ?? {})) omitted(key, `${location}/validations/${key}`)
  for (const key of Object.keys(field)) if (!['id', 'ref', 'title', 'type', 'properties', 'validations'].includes(key)) omitted(key, `${location}/${key}`)
}
