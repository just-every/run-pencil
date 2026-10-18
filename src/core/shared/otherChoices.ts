import { textAnswerIssue, textSettingsValid } from './textValidation'

export type OtherAnswer = { choiceIds: string[]; otherText: string }
export function isOtherAnswer(value: unknown): value is OtherAnswer {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 2 && 'choiceIds' in value && Array.isArray(value.choiceIds) &&
    value.choiceIds.every(id => typeof id === 'string') && 'otherText' in value && typeof value.otherText === 'string'
}
export function selectedChoiceIds(value: unknown): string[] {
  return isOtherAnswer(value) ? value.choiceIds : typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}
export function choiceSettingsValid(type: string, settings: Record<string, unknown>) {
  const { otherChoiceId, noneChoiceId } = settings
  return [otherChoiceId, noneChoiceId].every(id => id === undefined || typeof id === 'string' && id.length > 0 && id.length <= 200) &&
    (noneChoiceId === undefined || type === 'multiple_choice') &&
    (otherChoiceId === undefined || otherChoiceId !== noneChoiceId) &&
    (settings.otherValidation === undefined || !!settings.otherValidation && typeof settings.otherValidation === 'object' && !Array.isArray(settings.otherValidation) && textSettingsValid('short_text', settings.otherValidation as Record<string, unknown>))
}
export function otherChoiceIssue(type: string, settings: Record<string, unknown>, ids: string[], value: unknown): string | undefined {
  if (Array.isArray(value) && value.some(id => typeof id !== 'string')) return 'Choose valid available options.'
  const selected = selectedChoiceIds(value)
  if (!selected.length || selected.some(id => !ids.includes(id)) || new Set(selected).size !== selected.length ||
    (!isOtherAnswer(value) && !(typeof value === 'string' && type !== 'multiple_choice') && !(Array.isArray(value) && type === 'multiple_choice')) ||
    (type !== 'multiple_choice' && selected.length !== 1)) return 'Choose valid, distinct available options.'
  if (settings.noneChoiceId && selected.includes(String(settings.noneChoiceId))) {
    if (selected.length !== 1 || isOtherAnswer(value)) return 'None of the above must be selected alone.'
    return undefined
  }
  const hasOther = settings.otherChoiceId !== undefined && selected.includes(String(settings.otherChoiceId))
  if (hasOther) {
    if (!isOtherAnswer(value) || !value.otherText.trim()) return 'Please specify your Other answer.'
    const issue = textAnswerIssue('short_text', settings.otherValidation as Record<string, unknown> ?? {}, value.otherText)
    if (issue) return issue
  } else if (isOtherAnswer(value)) return 'Other text requires the Other option.'
  if (type === 'multiple_choice') {
    const min = typeof settings.minSelections === 'number' ? settings.minSelections : 1
    const max = typeof settings.maxSelections === 'number' ? settings.maxSelections : ids.length
    if (selected.length < min || selected.length > max) return `Choose between ${min} and ${max} distinct options.`
  }
}

/** Use only for choice answers, whose object shape is checked at collection. */
export function choiceIdsSql(value: string) {
  return `CASE WHEN json_type(${value})='object' THEN json_extract(${value}, '$.choiceIds') ELSE ${value} END`
}
export function remapChoiceSettings(settings: string | null, ids: ReadonlyMap<string, string>) {
  if (!settings) return settings
  const value = JSON.parse(settings) as Record<string, unknown>
  for (const key of ['otherChoiceId', 'noneChoiceId']) if (typeof value[key] === 'string') value[key] = ids.get(value[key]) ?? value[key]
  return JSON.stringify(value)
}
