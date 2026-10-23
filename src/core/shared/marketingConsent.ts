import type { FlowStep } from '../app/api'

/** GOV-007: what a consent can be given for. Email marketing may also be the form's own opt-in; SMS marketing never is. */
export const consentPurposes = ['email_marketing', 'sms_marketing', 'transactional_sms'] as const
export type ConsentPurpose = typeof consentPurposes[number]
export const consentPurposeLabels: Record<ConsentPurpose, string> = { email_marketing: 'Email marketing', sms_marketing: 'SMS marketing', transactional_sms: 'Transactional SMS' }
export const marketingWordingLimit = 500
/** A form-level opt-in: its wording is shown directly above the submit button and is the response's consent record for that purpose. */
export type MarketingOptIn = { purpose: ConsentPurpose; wording: string }
/** One response's consent for one purpose, as the published wording and the time it was given or declined. */
export type ConsentRecord = { purpose: ConsentPurpose; given: boolean; wording: string; at: string; source: 'form' | 'question' }

export function marketingSettingsIssue(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose valid marketing opt-in settings.'
  const settings = value as Record<string, unknown>
  if (Object.keys(settings).some(key => !['purpose', 'wording'].includes(key))) return 'Unknown marketing opt-in setting.'
  if (typeof settings.purpose !== 'string' || !(consentPurposes as readonly string[]).includes(settings.purpose)) return 'Choose a valid consent purpose.'
  if (typeof settings.wording !== 'string' || !settings.wording.trim() || settings.wording.length > marketingWordingLimit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(settings.wording)) return `Enter plain-text opt-in wording of at most ${marketingWordingLimit} characters.`
}

export function consentQuestionPurposeValid(purpose: unknown) {
  return purpose === undefined || (typeof purpose === 'string' && (consentPurposes as readonly string[]).includes(purpose))
}

type PublishStep = Pick<FlowStep, 'id' | 'kind' | 'questionType' | 'required' | 'questionSettings'>
/** Publish refuses a form that makes SMS marketing (or any non-email purpose) its own opt-in, and an SMS-marketing question that is required. */
export function marketingPublicationIssues(optIn: MarketingOptIn | undefined, steps: readonly PublishStep[]) {
  const issues: Array<{ stepId: string; reason: string }> = []
  if (optIn && optIn.purpose !== 'email_marketing') issues.push({ stepId: 'marketing:purpose', reason: 'SMS marketing consent cannot be a form-level opt-in. Use its own unticked consent question with the disclosure.' })
  for (const step of steps) {
    if (step.kind === 'question' && step.questionType === 'consent' && step.questionSettings?.purpose === 'sms_marketing' && step.required) issues.push({ stepId: step.id, reason: 'SMS marketing consent is never a condition of submitting. Make this consent question optional.' })
  }
  return issues
}

/** The records a response commits: the form's own opt-in (submitting is the consent) and every purpose-bound consent question the respondent answered. */
export function consentRecords(optIn: MarketingOptIn | undefined, steps: ReadonlyArray<{ id: string; questionType: string | null; questionSettings: Record<string, unknown> | null }>, answers: ReadonlyArray<{ stepId: string; value: unknown }>, at: string): ConsentRecord[] {
  const records: ConsentRecord[] = []
  if (optIn?.purpose === 'email_marketing') records.push({ purpose: 'email_marketing', given: true, wording: optIn.wording, at, source: 'form' })
  for (const step of steps) {
    const purpose = step.questionSettings?.purpose
    if (step.questionType !== 'consent' || typeof purpose !== 'string' || !(consentPurposes as readonly string[]).includes(purpose)) continue
    const answer = answers.find(item => item.stepId === step.id)?.value as { accepted?: unknown; statement?: unknown } | boolean | undefined
    const given = typeof answer === 'boolean' ? answer : answer?.accepted === true
    records.push({ purpose: purpose as ConsentPurpose, given, wording: String(step.questionSettings?.statement ?? ''), at, source: 'question' })
  }
  return records
}
