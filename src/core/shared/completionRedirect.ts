import type { FlowStep, PublicFlow } from '../app/api'
import { earlierRecallQuestions, interpolateAnswerRecall } from './answerRecall'
import type { FormSettings } from './hiddenFields'

export type CompletionRedirect = { url: string; parameters: Array<{ name: string; operand: string }> }
export function approvedOrigin(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.origin === value } catch { return false }
}
export function redirectShape(value: unknown): value is CompletionRedirect {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const redirect = value as CompletionRedirect
  return typeof redirect.url === 'string' && redirect.url.length <= 2048 && Array.isArray(redirect.parameters) && redirect.parameters.length <= 20
    && redirect.parameters.every(item => item && typeof item.name === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(item.name) && typeof item.operand === 'string' && item.operand.length <= 200 && Object.keys(item).every(key => ['name','operand'].includes(key)))
    && new Set(redirect.parameters.map(item => item.name)).size === redirect.parameters.length && Object.keys(redirect).every(key => ['url','parameters'].includes(key))
}
export function completionRedirectIssues(flow: Pick<PublicFlow,'steps'|'choices'|'branchRules'>, settings?: FormSettings) {
  return flow.steps.flatMap(step => {
    const redirect = step.questionSettings?.redirect
    if (redirect === undefined) return []
    const issue = (reason: string) => [{ stepId: step.id, reason }]
    if (step.kind !== 'completion' || !redirectShape(redirect)) return issue('A redirect belongs to a completion screen and needs a URL and distinct declared parameters (at most 20).')
    let url: URL
    try { url = new URL(redirect.url) } catch { return issue('Completion redirect needs an approved HTTPS URL.') }
    if (url.protocol !== 'https:' || url.username || url.password || !(settings?.redirectOrigins ?? []).includes(url.origin)) return issue('Completion redirect origin must be an approved HTTPS origin, without credentials.')
    // Reject template syntax: only explicitly declared query mappings can send answers.
    if (/[{}]|\*\|/.test(redirect.url)) return issue('Use declared redirect parameters instead of recall tokens in the URL.')
    const operands = new Set([...earlierRecallQuestions(flow,step.id).map(item => item.id), ...(settings?.hiddenFields ?? []).map(field => `hidden:${field.id}`), ...(settings?.calculations ?? []).map(variable => `variable:${variable.id}`)])
    const invalid = redirect.parameters.find(item => !operands.has(item.operand))
    return invalid ? issue(`Redirect parameter ${invalid.name} references a missing or off-path operand ${invalid.operand}.`) : []
  })
}
/** Use only the immutable admitted graph and its accepted answers, including on replay. */
export function completionRedirect(flow: Pick<PublicFlow,'steps'|'choices'|'branchRules'|'formSettings'|'hiddenContext'>, completionId: string, answers: Record<string,unknown>) {
  const step = flow.steps.find(step => step.id === completionId)
  const redirect = step?.questionSettings?.redirect
  if (!redirectShape(redirect) || completionRedirectIssues(flow,flow.formSettings).length) return null
  const url = new URL(redirect.url)
  for (const item of redirect.parameters) {
    const value = interpolateAnswerRecall(`{{${item.operand}}}`,flow,answers,completionId)
    if (value) url.searchParams.set(item.name,value)
    else url.searchParams.delete(item.name)
  }
  return url.href
}
