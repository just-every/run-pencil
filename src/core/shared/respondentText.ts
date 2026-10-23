import manifest from '../../../seed.json' with { type: 'json' }

/** LANG-002: the one place Pencil's respondent strings live. A form's published overrides replace a default only when they are not empty. */
export const respondentTextDefaults = {
  startLabel: 'Begin',
  nextLabel: 'Continue',
  submitLabel: 'Submit response',
  closedMessage: 'Thank you for your interest. This form is no longer accepting responses.',
  limitMessage: 'Thank you for your interest. This form has reached its response limit and is no longer accepting responses.',
  progressText: '{remaining} remaining',
} as const
export type RespondentTextKey = keyof typeof respondentTextDefaults
export type RespondentText = Partial<Record<RespondentTextKey, string>>
export const respondentTextLimits = manifest.limits.respondentText
const labels: readonly RespondentTextKey[] = ['startLabel', 'nextLabel', 'submitLabel']
const keys = Object.keys(respondentTextDefaults) as RespondentTextKey[]
const isLabel = (key: RespondentTextKey) => labels.includes(key)
const unsafe = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/

/** Shape and length, checked whenever settings are saved. A blank override is allowed here: it falls back to the default. */
export function respondentTextIssue(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose valid respondent text settings.'
  for (const [key, text] of Object.entries(value)) {
    if (!keys.includes(key as RespondentTextKey)) return 'Unknown respondent text setting.'
    const limit = isLabel(key as RespondentTextKey) ? respondentTextLimits.labelCharacters : respondentTextLimits.messageCharacters
    if (typeof text !== 'string' || text.length > limit) return `Use at most ${limit} characters for the ${key} text.`
    if (unsafe.test(text)) return `The ${key} text must be plain text without markup or control characters.`
  }
}

/** Publish refuses a label that would leave a button without an accessible name. */
export function respondentTextPublicationIssues(text: RespondentText | undefined) {
  return labels.filter(key => text?.[key] !== undefined && text[key] !== '' && !text[key]!.trim()).map(key => ({ stepId: `text:${key}`, reason: 'A button label cannot be only spaces. Enter a label or leave it empty to use the default.' }))
}

/** The override as published, or Pencil's default when it is missing or empty. */
export function respondentString(text: RespondentText | undefined, key: RespondentTextKey) {
  return text?.[key]?.trim() || respondentTextDefaults[key]
}
