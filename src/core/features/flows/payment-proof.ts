import type { FlowStep } from '../../app/api'
import { calculationInputs } from '../../shared/calculationInputs'
import type { Calculation, CalculationExpression } from '../../shared/calculations'
import type { FormSettings } from '../../shared/hiddenFields'
import { formatUsd, paymentStepSettingsIssue, type PaymentSettings } from '../../shared/payments'
import { visibilityCondition } from '../../shared/screenLayout'
import { scoreOptions, scoreQuestionTypes } from '../../shared/scoreQuestions'
import type { GraphIssue } from './graph'
import type { StoredChoice, StoredStep } from './repository'
import { publicSteps } from './serialization'

type Range = { lo: number; hi: number }
const unbounded: Range = { lo: -Infinity, hi: Infinity }
// Bounds of finite values: zero times an infinite bound is still zero.
const times = (left: number, right: number) => left === 0 || right === 0 ? 0 : left * right
const span = (values: number[]): Range => ({ lo: Math.min(...values), hi: Math.max(...values) })

function answerRange(step: FlowStep | undefined): Range {
  const settings = step?.questionSettings ?? {}
  const bound = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
  if (step?.questionType === 'number') return { lo: bound(settings.min, -Infinity), hi: bound(settings.max, Infinity) }
  if (step?.questionType === 'rating') return { lo: bound(settings.min, 1), hi: bound(settings.max, 5) }
  if (step?.questionType === 'nps') return { lo: 0, hi: 10 }
  if ((scoreQuestionTypes as readonly string[]).includes(step?.questionType ?? '')) return span(scoreOptions(step!.questionType!).map(option => Number(option.value)))
  return unbounded
}

/** A sound interval over every value the published inputs allow. Conditional branches are joined, so a
 * correlated expression can only be over-estimated, never under-estimated. */
function calculationRange(calculations: readonly Calculation[], id: string, questions: ReadonlyMap<string, FlowStep>, active = new Set<string>()): Range {
  const definition = calculations.find(calculation => calculation.id === id)
  if (!definition || active.has(id)) return unbounded
  active.add(id)
  const expression = (node: CalculationExpression): Range => {
    switch (node.kind) {
      case 'literal': return typeof node.value === 'number' ? { lo: node.value, hi: node.value } : unbounded
      case 'answer': return answerRange(questions.get(node.stepId))
      case 'variable': return calculationRange(calculations, node.variableId, questions, active)
      case 'conditional': { const then = expression(node.then), other = expression(node.else); return { lo: Math.min(then.lo, other.lo), hi: Math.max(then.hi, other.hi) } }
      case 'round': { const value = expression(node.value), factor = 10 ** node.decimalPlaces; return { lo: Math.round(value.lo * factor) / factor, hi: Math.round(value.hi * factor) / factor } }
      case 'add': { const left = expression(node.left), right = expression(node.right); return { lo: left.lo + right.lo, hi: left.hi + right.hi } }
      case 'subtract': { const left = expression(node.left), right = expression(node.right); return { lo: left.lo - right.hi, hi: left.hi - right.lo } }
      case 'multiply': { const left = expression(node.left), right = expression(node.right); return span([times(left.lo, right.lo), times(left.lo, right.hi), times(left.hi, right.lo), times(left.hi, right.hi)]) }
      case 'divide': {
        const left = expression(node.left), right = expression(node.right)
        if (right.lo <= 0 && right.hi >= 0) return unbounded
        const quotients = [left.lo / right.lo, left.lo / right.hi, left.hi / right.lo, left.hi / right.hi]
        return quotients.some(Number.isNaN) ? unbounded : span(quotients)
      }
      default: return unbounded
    }
  }
  const result = expression(definition.expression)
  active.delete(id)
  return result
}

function reachableWithout(first: string, target: string, removed: string, edges: ReadonlyMap<string, string[]>) {
  const seen = new Set<string>([removed]), pending = [first]
  while (pending.length) {
    const id = pending.pop()!
    if (id === target) return true
    if (seen.has(id)) continue
    seen.add(id)
    pending.push(...edges.get(id) ?? [])
  }
  return false
}

/** FLOW-006 for PAY-001: each issue names the payment step. `edges` are the publication's feasible edges. */
export function paymentIssues(steps: StoredStep[], choices: StoredChoice[], settings: FormSettings | undefined, edges: ReadonlyMap<string, string[]>): GraphIssue[] {
  const graph = publicSteps(steps), payments = graph.filter(step => step.kind === 'payment')
  if (!payments.length) return []
  const issues: GraphIssue[] = []
  const byId = new Map(graph.map(step => [step.id, step]))
  const first = graph.slice().sort((left, right) => left.position - right.position)[0]
  const calculations = settings?.calculations ?? []
  const choiceIds = (stepId: string) => { const row = steps.find(step => step.stableId === stepId); return choices.filter(choice => choice.stepId === row?.id).map(choice => choice.stableId) }
  for (const payment of payments) {
    const add = (reason: string) => issues.push({ stepId: payment.id, reason })
    // An answer every path to this step must give; any other source may be blank and add nothing.
    const guaranteed = (source: FlowStep) => source.required && !visibilityCondition(source) && !!first && !reachableWithout(first.id, payment.id, source.id, edges)
    const shape = paymentStepSettingsIssue('payment', payment.questionSettings)
    if (shape || !payment.questionSettings?.payment) { add(shape ?? 'A payment step needs its pricing: products, option prices or a calculated amount, with a minimum and maximum.'); continue }
    const pricing = payment.questionSettings.payment as PaymentSettings
    if (graph.some(step => step.kind === 'completion' && step.position < payment.position)) add('A payment step cannot come after a completion screen.')
    if (byId.get(payment.nextStepId ?? '')?.kind !== 'completion') add('A payment step must lead straight to a completion screen, so no answer arrives after the charge.')
    const sources = new Map<string, string>()
    const question = (stepId: string, purpose: string, types: string[]) => {
      const source = byId.get(stepId)
      if (!source || source.kind !== 'question' || !types.includes(source.questionType ?? '')) { add(`The ${purpose} names a missing or unsuitable question.`); return undefined }
      sources.set(stepId, source.prompt)
      return source
    }
    const ranges: Range[] = []
    if (pricing.calculationId !== undefined) {
      const calculation = calculations.find(value => value.id === pricing.calculationId)
      if (!calculation || calculation.type !== 'number') add('The calculated amount names a missing or non-numeric calculation.')
      else {
        const inputs = calculationInputs(calculations, calculation.id)
        if (inputs.hidden.size) add('A payment amount cannot depend on a hidden field: link values are unverified and the respondent could change them.')
        for (const stepId of inputs.answers) {
          const source = byId.get(stepId)
          if (!source || source.kind !== 'question') { add('The calculated amount reads a missing question.'); continue }
          sources.set(stepId, source.prompt)
          if (!guaranteed(source)) add(`A respondent could reach the payment step without answering “${source.prompt}”, which its calculated amount needs. Make it required and place it on every path to the payment step.`)
        }
        const range = calculationRange(calculations, calculation.id, byId)
        ranges.push({ lo: Math.round(range.lo * 100), hi: Math.round(range.hi * 100) })
      }
    }
    for (const product of pricing.products) {
      if (product.quantityStepId === undefined) { const quantity = product.quantity ?? 1; ranges.push({ lo: product.unitAmount * quantity, hi: product.unitAmount * quantity }); continue }
      const source = question(product.quantityStepId, `quantity of “${product.name}”`, ['number'])
      if (!source) continue
      const settingsOf = source.questionSettings ?? {}
      if (settingsOf.decimalPlaces !== 0) add(`The quantity of “${product.name}” must come from a whole-number question.`)
      const range = answerRange(source)
      ranges.push({ lo: guaranteed(source) ? times(product.unitAmount, Math.max(0, range.lo)) : 0, hi: times(product.unitAmount, Math.max(0, range.hi)) })
    }
    for (const option of pricing.options) {
      const source = question(option.stepId, 'option prices', ['single_choice', 'multiple_choice', 'dropdown'])
      if (!source) continue
      const ids = choiceIds(option.stepId)
      if (Object.keys(option.prices).some(id => !ids.includes(id))) add(`Option prices for “${source.prompt}” name a missing choice.`)
      const prices = ids.map(id => option.prices[id] ?? 0).sort((left, right) => left - right)
      const multiple = source.questionType === 'multiple_choice'
      const least = multiple ? Math.max(1, Number(source.questionSettings?.minSelections ?? 1)) : 1, most = multiple ? Number(source.questionSettings?.maxSelections ?? ids.length) : 1
      const sum = (values: number[]) => values.reduce((total, price) => total + price, 0)
      ranges.push({ lo: guaranteed(source) ? sum(prices.slice(0, least)) : 0, hi: sum(prices.slice(-most)) })
    }
    for (const [stepId, prompt] of sources) if ((byId.get(stepId)?.position ?? Infinity) > payment.position) add(`The payment step comes before “${prompt}”, so a later answer could change its amount.`)
    const total = ranges.reduce((sum, range) => ({ lo: sum.lo + range.lo, hi: sum.hi + range.hi }), { lo: 0, hi: 0 })
    if (total.lo < pricing.minimum || total.hi > pricing.maximum) add(`The amount can range from ${Number.isFinite(total.lo) ? formatUsd(Math.max(0, total.lo)) : 'unbounded'} to ${Number.isFinite(total.hi) ? formatUsd(total.hi) : 'unbounded'}, outside this step's minimum ${formatUsd(pricing.minimum)} and maximum ${formatUsd(pricing.maximum)}.`)
  }
  return issues
}
