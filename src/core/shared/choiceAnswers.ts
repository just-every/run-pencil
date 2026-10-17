import { textAnswerIssue, textSettingsValid } from './textValidation'

export const choiceQuestionTypes = ['single_choice', 'multiple_choice', 'dropdown'] as const
export function isChoiceQuestion(type: string | null | undefined) {
  return (choiceQuestionTypes as readonly string[]).includes(type ?? '')
}
export type OtherChoiceAnswer = { choiceIds: string[]; other: { choiceId: string; text: string } }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const idValid = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)

/** Strictly recognize the transport shape. Semantic checks still need the question. */
export function isOtherChoiceAnswer(value: unknown): value is OtherChoiceAnswer {
  return record(value) && Object.keys(value).length === 2 && Array.isArray(value.choiceIds)
    && value.choiceIds.every(idValid) && record(value.other) && Object.keys(value.other).length === 2
    && idValid(value.other.choiceId) && typeof value.other.text === 'string'
}
export function selectedChoiceIds(value: unknown): string[] {
  if (isOtherChoiceAnswer(value)) return value.choiceIds
  if (typeof value === 'string') return [value]
  return Array.isArray(value) && value.every(id => typeof id === 'string') ? value : []
}
export function otherChoiceText(value: unknown): string | undefined {
  return isOtherChoiceAnswer(value) ? value.other.text : undefined
}
export function otherTextSettings(settings: Record<string, unknown>): Record<string, unknown> {
  return record(settings.otherText) ? settings.otherText : {}
}
export function choiceSettingsValid(type: string | null, settings: Record<string, unknown>, choiceIds?: string[]): boolean {
  const keys = ['otherChoiceId', 'noneChoiceId', 'otherText']
  if (!isChoiceQuestion(type)) return keys.every(key => settings[key] === undefined)
  for (const key of ['otherChoiceId', 'noneChoiceId']) {
    const id = settings[key]
    if (id !== undefined && (!idValid(id) || choiceIds !== undefined && !choiceIds.includes(id))) return false
  }
  if (settings.noneChoiceId !== undefined && (type !== 'multiple_choice' || settings.noneChoiceId === settings.otherChoiceId)) return false
  if (type === 'multiple_choice') {
    for (const key of ['minSelections', 'maxSelections']) if (settings[key] !== undefined && (!Number.isInteger(settings[key]) || (settings[key] as number) < 0)) return false
    const min = typeof settings.minSelections === 'number' ? settings.minSelections : 1
    const max = typeof settings.maxSelections === 'number' ? settings.maxSelections : choiceIds?.length
    if (max !== undefined && (max < min || choiceIds !== undefined && max > choiceIds.length)) return false
  }
  if (settings.otherText !== undefined) {
    if (!settings.otherChoiceId || !record(settings.otherText)) return false
    const allowed = ['minLength', 'maxLength', 'inputMask', 'pattern', 'validationMessage']
    if (Object.keys(settings.otherText).some(key => !allowed.includes(key)) || !textSettingsValid('short_text', settings.otherText)) return false
  }
  return true
}

/** Construct after a selection change: deselecting Other always drops its text. */
export function makeChoiceAnswer(type: string, settings: Record<string, unknown>, choiceIds: string[], text = ''): string | string[] | OtherChoiceAnswer {
  if (typeof settings.otherChoiceId === 'string' && choiceIds.includes(settings.otherChoiceId)) {
    return { choiceIds: [...choiceIds], other: { choiceId: settings.otherChoiceId, text } }
  }
  return type === 'multiple_choice' ? [...choiceIds] : choiceIds[0] ?? ''
}

/** UI selection semantics; the API deliberately rejects contradictory selections. */
export function toggleChoiceAnswer(type: string, settings: Record<string, unknown>, value: unknown, choiceId: string, checked = true) {
  const previous = selectedChoiceIds(value)
  const ids = type !== 'multiple_choice' ? [choiceId] : !checked ? previous.filter(id => id !== choiceId)
    : choiceId === settings.noneChoiceId ? [choiceId]
      : [...previous.filter(id => id !== settings.noneChoiceId && id !== choiceId), choiceId]
  return makeChoiceAnswer(type, settings, ids, otherChoiceText(value))
}

export function choiceAnswerIssue(type: string | null, settings: Record<string, unknown>, availableIds: string[], value: unknown): string | undefined {
  if (!choiceSettingsValid(type, settings, availableIds)) return 'This question has invalid choice settings.'
  const object = isOtherChoiceAnswer(value)
  const ids = selectedChoiceIds(value)
  const multiple = type === 'multiple_choice'
  const min = typeof settings.minSelections === 'number' ? settings.minSelections : 1
  const max = typeof settings.maxSelections === 'number' ? settings.maxSelections : availableIds.length
  const invalid = multiple ? `Choose between ${min} and ${max} distinct options.` : 'Choose one of the available options.'
  if (!ids.length || ids.some(id => !availableIds.includes(id)) || new Set(ids).size !== ids.length) return invalid
  if (!object && (multiple ? !Array.isArray(value) : typeof value !== 'string')) return invalid
  if (!multiple && ids.length !== 1) return invalid
  if (settings.noneChoiceId && ids.includes(settings.noneChoiceId as string) && ids.length !== 1) return 'None of the above must be selected on its own.'
  const noneAlone = ids.length === 1 && ids[0] === settings.noneChoiceId
  if (multiple && (!noneAlone && ids.length < min || ids.length > max)) return invalid
  const otherSelected = typeof settings.otherChoiceId === 'string' && ids.includes(settings.otherChoiceId)
  if (otherSelected) {
    if (!object || value.other.choiceId !== settings.otherChoiceId) return 'Enter text for the selected Other option.'
    if (!value.other.text.trim()) return 'Enter text for the selected Other option.'
    return textAnswerIssue('short_text', otherTextSettings(settings), value.other.text)
  }
  if (object) return 'Other text is only allowed while its Other option is selected.'
  return undefined
}

/** Stable identity remapping for native/imported copies; labels never carry roles. */
export function remapChoiceSettings(settings: Record<string, unknown>, ids: ReadonlyMap<string, string> | Record<string, string>): Record<string, unknown> {
  const mapped = { ...settings }
  for (const key of ['otherChoiceId', 'noneChoiceId']) {
    const id = mapped[key]
    if (typeof id === 'string') mapped[key] = ids instanceof Map ? ids.get(id) ?? id : (ids as Record<string, string>)[id] ?? id
  }
  return mapped
}
