import { ValidationError } from '../../shared/errors'
import { sha256 } from '../../../base/import-kit/src/provenance/identity'
import type { ImportForm, ImportStep, QuestionType, ReportItem } from './model'
import { forbiddenSource, sourceNames } from './source-privacy'
export const stableId = (scope: string, id: string) => `i_${sha256(scope + ':' + id).slice(0, 28)}`
export function object(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {} }
export function mapFields(definition: Record<string, any>, scope: string, forbidden: Set<string>): ImportForm {
  const report: ReportItem[] = [], steps: ImportStep[] = []
  const identities = new Set<string>()
  const add = (raw: unknown, location: string, kind?: 'welcome' | 'completion') => {
    const field = object(raw), properties = object(field.properties), validations = object(field.validations)
    const type = String(field.type ?? kind ?? 'unknown'), sourceId = String(field.ref ?? field.id ?? '')
    const item: ReportItem = { location, label: String(field.title ?? '(untitled)'), sourceType: type, state: 'imported', change: '', reason: '' }
    report.push(item)
    if (!kind && sourceNames(field).some(name => forbiddenSource(name, forbidden))) { item.label = 'Private source field'; item.state = 'unsupported'; item.change = 'Field and answers omitted'; item.reason = 'Hidden and network/IP source identities cannot be imported, including through their display titles.'; return }
    if (!sourceId || identities.has(sourceId)) { item.state = 'unsupported'; item.reason = 'Missing or duplicated field reference; no identity was guessed.'; return }
    identities.add(sourceId)
    // Typeform's documented choice types: picture_choice follows allow_multiple_selection like multiple_choice; checkbox always allows several.
    const choiceTypes = ['multiple_choice', 'picture_choice', 'checkbox', 'dropdown', 'ranking']
    const selection: QuestionType = properties.allow_multiple_selection === true ? 'multiple_choice' : 'single_choice'
    const mapped: Record<string, QuestionType> = { short_text: 'short_text', long_text: 'long_text', email: 'email', multiple_choice: selection, picture_choice: selection, checkbox: 'multiple_choice', dropdown: 'dropdown', yes_no: 'yes_no', rating: 'rating', opinion_scale: 'rating', nps: 'nps', number: 'number', date: 'date', legal: 'consent', ranking: 'priority', phone_number: 'short_text', website: 'short_text' }
    if (['picture_choice', 'checkbox'].includes(type) && !(Array.isArray(properties.choices) && properties.choices.length)) { item.state = 'unsupported'; item.reason = 'A choice field without choices has no native representation. The field and its answers are omitted.'; return }
    if (type === 'statement' && steps.length === 0 && !kind) kind = 'welcome'
    const questionType = kind ? null : mapped[type]
    if (!kind && !questionType) { item.state = 'unsupported'; item.reason = 'No native question representation. The field and its answers are omitted.'; const nested = (values: unknown, path: string) => { if (!Array.isArray(values)) return; for (const [i, value] of values.entries()) { const child = object(value); report.push({ location: `${path}/${i}`, label: String(child.title ?? '(untitled)'), sourceType: String(child.type ?? 'unknown'), state: 'unsupported', change: 'Nested field omitted', reason: 'Its parent field has no native representation; groups are not flattened.' }); nested(object(child.properties).fields, `${path}/${i}/properties/fields`) } }; nested(properties.fields, `${location}/properties/fields`); return }
    const choices = choiceTypes.includes(type) && Array.isArray(properties.choices) ? properties.choices.map((c: any, i: number) => ({ id: stableId(scope, `${sourceId}:choice:${c.ref ?? c.id ?? i}`), sourceId: String(c.ref ?? c.id ?? i), label: String(c.label ?? '') })) : []
    const settings: Record<string, unknown> = {}
    if (properties.allow_other_choice !== undefined && typeof properties.allow_other_choice !== 'boolean') throw new ValidationError('Typeform allow_other_choice must be a Boolean.')
    if (properties.allow_other_choice === true && ['single_choice', 'multiple_choice', 'dropdown'].includes(questionType ?? '')) {
      const id = stableId(scope, `${sourceId}:other`)
      choices.push({ id, sourceId: '__other__', label: 'Other' })
      settings.otherChoiceId = id
    }
    if (questionType === 'rating') {
      const start = type === 'rating' ? 1 : properties.start_at_one === true ? 1 : 0
      if (!Number.isInteger(properties.steps) || (type === 'opinion_scale' && typeof properties.start_at_one !== 'boolean')) { item.state = 'unsupported'; item.reason = 'A scale needs explicit steps and opinion-scale start_at_one.'; return }
      settings.min = start; settings.max = start + properties.steps - 1
      const labels = object(properties.labels)
      for (const [source, target] of [['left','lowLabel'],['center','middleLabel'],['right','highLabel']]) if (labels[source] !== undefined) settings[target] = labels[source]
    }
    if (questionType === 'multiple_choice') { settings.minSelections = validations.min_selection ?? (validations.required ? 1 : 0); settings.maxSelections = validations.max_selection ?? choices.length }
    if (questionType === 'number') { if (validations.min_value !== undefined) settings.min = validations.min_value; if (validations.max_value !== undefined) settings.max = validations.max_value }
    if (questionType === 'short_text' || questionType === 'long_text') { if (validations.max_length !== undefined) settings.maxLength = validations.max_length; if (validations.min_length !== undefined) settings.minLength = validations.min_length }
    if (questionType === 'date') {
      if (properties.structure !== undefined) settings.displayFormat = ({ MMDDYYYY:'MM/DD/YYYY', DDMMYYYY:'DD/MM/YYYY', YYYYMMDD:'YYYY-MM-DD' } as Record<string,string>)[String(properties.structure)] ?? properties.structure
      if (properties.separator !== undefined) settings.separator = properties.separator
    }
    if (questionType === 'consent') settings.statement = String(field.title ?? '')
    if (['phone_number', 'website'].includes(type)) { item.state = 'changed'; item.change = 'Short text'; item.reason = 'Phone or URL validation is not imported; the native 200-character limit applies.' }
    else if (type === 'statement') { item.state = 'changed'; item.change = 'Welcome screen'; item.reason = 'Only the first statement can become the welcome screen.' }
    else { item.change = kind ?? questionType!; item.reason = 'Prompt, description, required state and supported answer semantics are mapped.' }
    const step: ImportStep = { id: stableId(scope, sourceId), sourceId, sourceType: type, kind: kind ?? 'question', questionType: questionType ?? null, prompt: String(field.title ?? ''), helperText: properties.description == null ? null : String(properties.description), required: validations.required === true, settings, choices, next: null }
    steps.push(step)
    // Each property not represented by native behavior receives its own review item.
    const known = new Set(['description', ...(choiceTypes.includes(type) ? ['choices'] : []), ...(['multiple_choice', 'picture_choice'].includes(type) ? ['allow_multiple_selection'] : []), ...(['rating', 'opinion_scale'].includes(type) ? ['steps', 'labels'] : []), ...(['single_choice', 'multiple_choice', 'dropdown'].includes(questionType ?? '') ? ['allow_other_choice'] : []), ...(type === 'opinion_scale' ? ['start_at_one'] : []), ...(questionType === 'date' ? ['structure', 'separator'] : [])])
    for (const [i, choice] of (Array.isArray(properties.choices) ? properties.choices : []).entries()) for (const key of Object.keys(object(choice))) if (!['id', 'ref', 'label'].includes(key)) report.push({ location: `${location}/properties/choices/${i}/${key}`, label: step.prompt, sourceType: type, state: 'unsupported', change: 'Choice property omitted', reason: `${key} is not reproduced.` })
    for (const [key] of Object.entries(properties)) if (!known.has(key)) report.push({ location: `${location}/properties/${key}`, label: step.prompt, sourceType: type, state: 'unsupported', change: 'Property omitted', reason: `${key} has no imported native behavior.` })
    for (const key of Object.keys(validations)) if (!['required', ...(['short_text','long_text'].includes(questionType ?? '') ? ['max_length','min_length'] : []), ...(questionType === 'multiple_choice' ? ['min_selection', 'max_selection'] : []), ...(questionType === 'number' ? ['min_value', 'max_value'] : [])].includes(key)) report.push({ location: `${location}/validations/${key}`, label: step.prompt, sourceType: type, state: 'unsupported', change: 'Validation omitted', reason: `${key} is not reproduced; native validation applies.` })
    for (const key of Object.keys(field)) if (!['id', 'ref', 'title', 'type', 'properties', 'validations'].includes(key)) report.push({ location: `${location}/${key}`, label: step.prompt, sourceType: type, state: 'unsupported', change: 'Property omitted', reason: `${key} is not reproduced.` })
  }
  for (const [i, screen] of (definition.welcome_screens ?? []).entries()) {
    if (i === 0) add(screen, `/welcome_screens/${i}`, 'welcome')
    else report.push({ location: `/welcome_screens/${i}`, label: String(screen.title ?? ''), sourceType: 'welcome', state: 'unsupported', change: 'Screen omitted', reason: 'Only one first welcome screen is supported.' })
  }
  for (const [i, field] of definition.fields.entries()) add(field, `/fields/${i}`)
  for (const [i, screen] of (definition.thankyou_screens ?? []).entries()) add(screen, `/thankyou_screens/${i}`, 'completion')
  if (!steps.some(s => s.kind === 'completion')) {
    steps.push({ id: stableId(scope, 'generated-completion'), sourceId: 'generated-completion', sourceType: 'generated', kind: 'completion', questionType: null, prompt: 'Thank you', helperText: null, required: false, settings: {}, choices: [], next: null })
    report.push({ location: '/thankyou_screens', label: 'Thank you', sourceType: 'missing', state: 'changed', change: 'Completion added', reason: 'A native flow requires a completion screen.' })
  }
  steps.forEach((step, i) => { if (step.kind !== 'completion') step.next = steps[i + 1]?.id ?? null })
  for (const key of Object.keys(definition)) if (!['id', 'title', 'fields', 'welcome_screens', 'thankyou_screens', 'logic'].includes(key)) report.push({ location: `/${key}`, label: key, sourceType: 'form property', state: 'unsupported', change: 'Omitted', reason: ['hidden', 'variables'].includes(key) ? 'Hidden fields, variables and scoring are never imported.' : 'Settings, styling, integrations and other form properties are not reproduced.' })
  return { title: String(definition.title ?? ''), steps, rules: [], report }
}
