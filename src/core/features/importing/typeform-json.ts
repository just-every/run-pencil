import { calendarDate } from '../../shared/questionTypes'
import { object } from './fields'
import { typeformChoiceAnswer, type ChoiceResolver } from './choice-values'
import { forbiddenSource } from './source-privacy'
import type { ImportForm, ImportStep } from './model'

type SourceQuestion = { field: Record<string, any>; step?: ImportStep }
export function typeformJsonAnswers(definition: Record<string, any>, form: ImportForm, forbidden: Set<string>) {
  const sources: SourceQuestion[] = []
  const visit = (fields: unknown) => {
    if (!Array.isArray(fields)) return
    for (const raw of fields) {
      const field = object(raw)
      sources.push({ field, step: form.steps.find(s => s.kind === 'question' && s.sourceId === String(field.ref ?? field.id ?? '')) })
      visit(object(field.properties).fields)
    }
  }
  visit(definition.fields)
  return (raw: unknown): { step: ImportStep; value: unknown } | undefined => {
    const answer = object(raw), field = object(answer.field)
    const aliases = [field.ref, field.id].filter((v): v is string => typeof v === 'string' && !!v)
    if (!aliases.length) throw new Error('Typeform answers require a source field ID or reference.')
    if (aliases.some(alias => forbiddenSource(alias, forbidden))) return
    const matches = sources.filter(source => aliases.some(alias => source.field.ref === alias || source.field.id === alias))
    if (matches.length !== 1 || aliases.some(alias => matches[0].field.ref !== alias && matches[0].field.id !== alias)) throw new Error('Typeform answer field identity is unknown or ambiguous.')
    const { step, field: source } = matches[0]
    // Unsupported and private source fields already have an explicit definition review item.
    if (!step) return
    const type = step.questionType
    let value: unknown
    if (['single_choice', 'dropdown', 'multiple_choice', 'priority'].includes(type!)) {
      const resolve: ChoiceResolver = (kind, identity) => {
        const choices = (object(source.properties).choices as any[] ?? []).filter(c => object(c)[kind] === identity)
        if (choices.length !== 1) throw new Error('Typeform answer choice identity is unknown or ambiguous.')
        const choice = object(choices[0]), index = object(source.properties).choices.indexOf(choices[0])
        const native = step.choices.find(c => c.sourceId === String(choice.ref ?? choice.id ?? index))
        if (!native) throw new Error('Typeform answer has no native choice identity.')
        return native.id
      }
      if (!['choice', 'choices'].includes(answer.type)) throw new Error('Typeform choice answers require choice or choices values.')
      value = typeformChoiceAnswer(answer, step, resolve)
    } else {
      const key = ({ short_text: 'text', long_text: 'text', email: 'email', yes_no: 'boolean', consent: 'boolean', number: 'number', rating: 'number', nps: 'number', date: 'date' } as Record<string, string>)[type!]
      const sourceKey = source.type === 'phone_number' ? 'phone_number' : source.type === 'website' ? 'url' : key
      if (!sourceKey || answer.type !== sourceKey || !Object.hasOwn(answer, sourceKey)) throw new Error('Typeform answer type does not match its source question.')
      value = answer[sourceKey]
      if (type === 'consent') value = { accepted: value, statement: step.settings.statement }
      if (type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(value) && calendarDate(value.slice(0, 10))) value = value.slice(0, 10)
    }
    return { step, value }
  }
}
