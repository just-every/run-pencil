import { approvedOrigin } from './completionRedirect'
import { calculationsShape } from './calculationValidation'
import type { Calculation } from './calculations'
import manifest from '../../../seed.json' with { type: 'json' }
import { calendarDate } from './questionTypes'
import type { FlowStep } from '../app/api'

export type HiddenField = { id: string; name: string; type: 'text' | 'number' | 'email' | 'date' | 'boolean'; category: 'plain' | 'campaign' | 'identifying' | 'click_id' }
export type FormSettings = { redirectOrigins?: string[]; calculations?: Calculation[]; hiddenFields: HiddenField[]; identityMode: 'anonymous' | 'identified' }
export type ResponseContext = { calculations?: Record<string,number|string|null>; hidden: Record<string, string | number | boolean>; discarded: number; identityMode: 'anonymous' | 'identified' }
const reserved = new Set(['collector','resume','source','challenge','kiosk','__proto__','constructor','prototype'])
export const hiddenFieldLimits = manifest.limits.hiddenFields

export function formSettings(json?: string | null): FormSettings {
  const value = JSON.parse(json ?? '{}') as Partial<FormSettings>
  return { ...(value.redirectOrigins ? {redirectOrigins:value.redirectOrigins} : {}), calculations:value.calculations ?? [], hiddenFields: value.hiddenFields ?? [], identityMode: value.identityMode ?? 'anonymous' }
}
export function hiddenSettingsIssue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose valid hidden-field settings.'
  if (Object.keys(value).some(key=>!['hiddenFields','identityMode','calculations','redirectOrigins'].includes(key))) return 'Unknown form setting.'
  const settings = value as FormSettings
  if (settings.redirectOrigins !== undefined && (!Array.isArray(settings.redirectOrigins) || settings.redirectOrigins.length > 20 || settings.redirectOrigins.some(origin => typeof origin !== 'string' || !approvedOrigin(origin)) || new Set(settings.redirectOrigins).size !== settings.redirectOrigins.length)) return 'Approve at most 20 distinct HTTPS origins, without paths or credentials.'
  if (settings.calculations !== undefined && !calculationsShape(settings.calculations)) return 'Calculations need valid typed expressions within the configured limits.'
  if (!['anonymous','identified'].includes(settings.identityMode) || !Array.isArray(settings.hiddenFields) || settings.hiddenFields.length > hiddenFieldLimits.perRevision) return 'Choose an identity mode and at most 20 hidden fields.'
  for (const field of settings.hiddenFields) {
    if (!field || typeof field !== 'object' || typeof field.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(field.id) || typeof field.name !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(field.name) || reserved.has(field.name)) return 'Each hidden field needs a stable ID and a distinct lowercase parameter name (letters, numbers and underscores). Collection and resume parameter names are reserved.'
    if (!['text','number','email','date','boolean'].includes(field.type) || !['plain','campaign','identifying','click_id'].includes(field.category)) return `Hidden field ${field.name} needs a valid type and purpose.`
    if (Object.keys(field).some(key=>!['id','name','type','category'].includes(key))) return 'Unknown hidden-field setting.'
    if (field.type === 'email' && field.category !== 'identifying') return `Email field ${field.name} must be declared identifying.`
    if (['fbclid','gclid','gbraid','wbraid','ga_client_id'].includes(field.name) && field.category !== 'click_id') return `${field.name} must be declared a click ID.`
  }
  if (new Set(settings.hiddenFields.map(field => field.id)).size !== settings.hiddenFields.length || new Set(settings.hiddenFields.map(field => field.name)).size !== settings.hiddenFields.length) return 'Hidden field IDs and parameter names must be distinct.'
}
export function hiddenPublicationIssues(settings: FormSettings) {
  return settings.hiddenFields.filter(field => settings.identityMode === 'anonymous' && field.category === 'identifying').map(field => ({ stepId: `hidden:${field.id}`, reason: `Identifying field ${field.name} requires identified public links. Change the identity mode or remove the field.` }))
}
export function hiddenValue(field: HiddenField, raw: unknown): string | number | boolean | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') return undefined
  const text = String(raw).trim().normalize('NFC')
  if (!text || text.length > hiddenFieldLimits.textCharacters || /\*\|[^|]+\|\*|\{[^}]*\}|%%[^%]+%%/.test(text)) return undefined
  if (field.type === 'text') return text
  if (field.type === 'number') return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(text) && Number.isFinite(Number(text)) ? Number(text) : undefined
  if (field.type === 'boolean') return text === 'true' ? true : text === 'false' ? false : undefined
  if (field.type === 'date') return calendarDate(text) ? text : undefined
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(text) ? text : undefined
}
/** Parameters are unverified respondent input. No value enters session metrics. */
export function normalizeHidden(settings: FormSettings, raw: Record<string, unknown>): ResponseContext {
  const hidden: ResponseContext['hidden'] = Object.create(null)
  let discarded = 0
  for (const [name, candidate] of Object.entries(raw)) {
    const field = settings.hiddenFields.find(field => field.name === name)
    const value = field && hiddenValue(field, candidate)
    if (!field || value === undefined || settings.identityMode === 'anonymous' && ['identifying','click_id'].includes(field.category)) { discarded++; continue }
    hidden[field.id] = value
  }
  return { hidden, discarded, identityMode: settings.identityMode }
}
export function hiddenOperands(fields: HiddenField[]): FlowStep[] {
  return fields.map(field => ({ id: `hidden:${field.id}`, position: -1, kind: 'question', questionType: field.type === 'text' ? 'short_text' : field.type === 'boolean' ? 'yes_no' : field.type, prompt: `Hidden: ${field.name}`, helperText: null, required: false, nextStepId: null, questionSettings: null }))
}
export function hiddenAnswers(context: Pick<ResponseContext,'hidden'>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(context.hidden ?? {}).map(([id,value]) => [`hidden:${id}`,value]))
}
