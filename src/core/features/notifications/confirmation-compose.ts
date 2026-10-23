import type { PublicFlow } from '../../app/api'
import { interpolateAnswerRecall } from '../../shared/answerRecall'
import { answerIssue, isUnanswered } from '../../shared/answers'
import { calculationInputs } from '../../shared/calculationInputs'
import { confirmationSettingsIssue, type ConfirmationSettings } from '../../shared/confirmationSettings'
import { visiblePath } from '../../shared/flowPath'
import type { FormSettings } from '../../shared/hiddenFields'
import { validateLogo } from '../brand'
import type { NotificationBrand } from './brand'
import { buttonTextColor } from './compose'

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const logoExtensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const header = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').slice(0, 200)

/** Text fields share the explicit short/long text gate; booleans use Yes / No. */
function permittedType(type: string | null | undefined, settings: ConfirmationSettings): boolean {
  if (!settings.includeAnswers || !type) return false
  if (type === 'text') return settings.answerTypes.includes('short_text') || settings.answerTypes.includes('long_text')
  return settings.answerTypes.includes(type === 'boolean' ? 'yes_no' : type)
}

function recallFilter(flow: PublicFlow, settings: ConfirmationSettings) {
  const questionAllowed = (id: string) => flow.steps.some(step => step.id === id && step.kind === 'question' && permittedType(step.questionType, settings))
  const hiddenAllowed = (id: string) => flow.formSettings?.hiddenFields.some(field => field.id === id && permittedType(field.type, settings)) ?? false
  const calculations: NonNullable<FormSettings['calculations']> = flow.formSettings?.calculations ?? []
  const allowed = (reference: string) => {
    if (reference.startsWith('hidden:')) return hiddenAllowed(reference.slice(7))
    if (!reference.startsWith('variable:')) return questionAllowed(reference)
    const id = reference.slice(9), calculation = calculations.find(value => value.id === id)
    if (!calculation || !permittedType(calculation.type, settings)) return false
    const inputs = calculationInputs(calculations, id)
    return [...inputs.answers].every(questionAllowed) && [...inputs.hidden].every(hiddenAllowed)
      && [...inputs.variables].every(id => permittedType(calculations.find(value => value.id === id)?.type, settings))
  }
  return (text: string) => text.replace(/\{\{([^{}]*)\}\}/g, (token, reference: string) => allowed(reference.trim()) ? token : '')
}

/** Stored consent carries its published statement; path traversal consumes booleans. */
function pathAnswers(flow: PublicFlow, answers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(flow.steps.flatMap(step => {
    if (step.kind !== 'question' || !Object.hasOwn(answers, step.id)) return []
    let value = answers[step.id]
    if (step.questionType === 'consent' && value && typeof value === 'object' && !Array.isArray(value)) {
      const consent = value as Record<string, unknown>
      value = consent.statement === step.questionSettings?.statement ? consent.accepted : undefined
    }
    const choices = flow.choices.filter(choice => choice.stepId === step.id).map(choice => choice.id)
    return isUnanswered(value) || answerIssue(step, choices, value) ? [] : [[step.id, value]]
  }))
}

/** No recipient, Reply-To, response capability or ledger link crosses this boundary. */
export function composeRespondentConfirmation(input: { brand: NotificationBrand; flow: PublicFlow; answers: Record<string, unknown>; completionStepId: string; settings: ConfirmationSettings }) {
  const { brand, flow, answers, completionStepId, settings } = input
  const issue = confirmationSettingsIssue(settings)
  if (issue) throw new Error(issue)
  if (!settings.enabled) throw new Error('Respondent confirmation email is disabled.')
  const path = visiblePath(flow, pathAnswers(flow, answers))
  if (!path.some(step => step.id === completionStepId && step.kind === 'completion')) throw new Error('Confirmation requires the completed response path.')
  const filter = recallFilter(flow, settings)
  // Retain original branch inputs. Only authored text changes: filtering answers
  // would change the route, while unfiltered choice labels could leak nested recall.
  const safeFlow = { ...flow, choices: flow.choices.map(choice => ({ ...choice, label: filter(choice.label) })) }
  const recall = (text: string, destination = completionStepId) => interpolateAnswerRecall(filter(text), safeFlow, answers, destination)
  const subject = header(recall(settings.subject))
  const body = recall(settings.body)
  const rows = path.flatMap(step => {
    if (step.kind !== 'question' || !permittedType(step.questionType, settings)) return []
    const value = recall(`{{${step.id}}}`)
    return value ? [{ label: recall(step.prompt, step.id), value }] : []
  })
  const foreground = buttonTextColor(brand.accentColor)
  let attachment
  if (brand.logo) {
    validateLogo(brand.logo.content, brand.logo.contentType)
    attachment = { filename: `business-logo.${logoExtensions[brand.logo.contentType]}`, contentType: brand.logo.contentType, content: brand.logo.content, disposition: 'inline' as const, contentId: 'business-logo@pencil' }
  }
  const heading = `Response received: ${flow.flow.title}`
  const footer = 'This is an automated confirmation of your submission. Replies are not monitored.'
  const answerText = rows.length ? `\n\nYour answers\n${rows.map(row => `${row.label}\n${row.value}`).join('\n\n')}` : ''
  return {
    subject,
    text: `${brand.businessName}\n${brand.supportingLine ? `${brand.supportingLine}\n` : ''}${heading}\n\n${body}${answerText}\n\n${footer}`,
    html: `<!doctype html><html lang="en"><head><title>${escape(subject)}</title></head><body style="margin:0;background:#f7f7f5;color:#202720;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:24px;background:#fff;overflow-wrap:anywhere">${attachment ? `<img src="cid:${attachment.contentId}" alt="${escape(brand.businessName)}" style="display:block;max-width:160px;max-height:80px" />` : ''}<p dir="auto">${escape(brand.businessName)}</p>${brand.supportingLine ? `<p dir="auto">${escape(brand.supportingLine)}</p>` : ''}<h1 dir="auto" style="font-size:24px;padding:14px 20px;background:${brand.accentColor};color:${foreground}">${escape(heading)}</h1><p dir="auto" style="white-space:pre-wrap">${escape(body)}</p>${rows.length ? `<h2>Your answers</h2><dl>${rows.map(row => `<dt dir="auto" style="font-weight:bold;white-space:pre-wrap">${escape(row.label)}</dt><dd dir="auto" style="margin:4px 0 20px;white-space:pre-wrap">${escape(row.value)}</dd>`).join('')}</dl>` : ''}<p style="font-size:14px">${escape(footer)}</p></main></body></html>`,
    ...(attachment ? { attachments: [attachment] } : {}),
  }
}
