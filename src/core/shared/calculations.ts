import manifest from '../../../seed.json' with { type: 'json' }
import { evaluateCondition, conditionTests, type Condition } from './conditions'
import { conditionShape } from './conditionValidation'
import { calendarDate } from './questionTypes'

export type CalculationType = 'number' | 'text'
export type CalculationValue = number | string | null
export type CalculationExpression =
  | { kind: 'literal'; value: number | string }
  | { kind: 'answer'; stepId: string }
  | { kind: 'hidden'; fieldId: string }
  | { kind: 'variable'; variableId: string }
  | { kind: 'add' | 'subtract' | 'multiply' | 'divide'; left: CalculationExpression; right: CalculationExpression }
  | { kind: 'conditional'; condition: Condition; then: CalculationExpression; else: CalculationExpression }
  | { kind: 'round'; value: CalculationExpression; decimalPlaces: number }
  | { kind: 'date_difference'; start: CalculationExpression; end: CalculationExpression; unit: 'days' | 'months' | 'years' }
export type Calculation = { id: string; name: string; type: CalculationType; expression: CalculationExpression }

export const calculationLimits = manifest.limits.calculations

function scalar(value: unknown): CalculationValue {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  return typeof value === 'string' && value.trim() && value.length <= calculationLimits.textCharacters ? value : null
}

/** Complete calendar units, signed from start to end; no local time conversion. */
function dateDifference(start: string, end: string, unit: 'days' | 'months' | 'years'): number {
  const parts = (value: string) => value.split('-').map(Number)
  const ordinal = ([year, month, day]: number[]) => {
    const previousYear = year - 1
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return previousYear * 365 + Math.floor(previousYear / 4) - Math.floor(previousYear / 100) + Math.floor(previousYear / 400)
      + [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][month - 1] + (month > 2 && leap ? 1 : 0) + day
  }
  if (unit === 'days') return ordinal(parts(end)) - ordinal(parts(start))
  const sign = end < start ? -1 : 1
  const [firstYear, firstMonth, firstDay] = parts(sign < 0 ? end : start)
  const [lastYear, lastMonth, lastDay] = parts(sign < 0 ? start : end)
  const months = (lastYear - firstYear) * 12 + lastMonth - firstMonth - (lastDay < firstDay ? 1 : 0)
  return sign * (unit === 'years' ? Math.trunc(months / 12) : months)
}

/** Callers supply only accepted on-path answers. Missing and invalid operands stay blank. */
export function evaluateCalculations(calculations: readonly Calculation[], answers: Record<string, unknown>, hidden: Record<string, unknown>): Record<string, CalculationValue> {
  const result: Record<string, CalculationValue> = Object.create(null)
  const definitions = new Map(calculations.map(calculation => [calculation.id, calculation]))
  const active = new Set<string>()
  const invalid = new Set<string>()
  let budget = calculationLimits.perRevision * calculationLimits.expressionNodes
  const context: Record<string, unknown> = { ...answers }
  for (const id of Object.keys(context)) if (id.startsWith('variable:') || id.startsWith('hidden:')) delete context[id]
  for (const [id, value] of Object.entries(hidden)) context[`hidden:${id}`] = value
  const resolve = (id: string): CalculationValue => {
    if (Object.hasOwn(result, id)) return result[id]
    const definition = definitions.get(id)
    if (!definition || active.has(id) || calculations.length > calculationLimits.perRevision) {
      if (active.has(id)) for (const member of active) invalid.add(member)
      return null
    }
    active.add(id)
    const value = expression(definition.expression, 0, { count: 0 })
    active.delete(id)
    const typed = definition.type === 'number' ? typeof value === 'number' : definition.type === 'text' && typeof value === 'string'
    result[id] = typed && !invalid.has(id) ? value : null
    context[`variable:${id}`] = result[id]
    return result[id]
  }
  const expression = (node: CalculationExpression, depth: number, size: { count: number }): CalculationValue => {
    if (!node || typeof node !== 'object' || depth > calculationLimits.expressionDepth || ++size.count > calculationLimits.expressionNodes || --budget < 0) return null
    const child = (value: CalculationExpression) => expression(value, depth + 1, size)
    switch (node.kind) {
      case 'literal': return scalar(node.value)
      case 'answer': return scalar(Object.hasOwn(answers, node.stepId) ? answers[node.stepId] : null)
      case 'hidden': return scalar(Object.hasOwn(hidden, node.fieldId) ? hidden[node.fieldId] : null)
      case 'variable': return resolve(node.variableId)
      case 'conditional': {
        if (!conditionShape(node.condition)) return null
        for (const test of conditionTests(node.condition)) {
          if (test.stepId.startsWith('variable:')) {
            const value = resolve(test.stepId.slice('variable:'.length))
            context[test.stepId] = value
          }
        }
        return child(evaluateCondition(node.condition, context).matched ? node.then : node.else)
      }
      case 'round': {
        if (!Number.isInteger(node.decimalPlaces) || node.decimalPlaces < 0 || node.decimalPlaces > calculationLimits.decimalPlaces) return null
        const value = child(node.value)
        if (typeof value !== 'number') return null
        const factor = 10 ** node.decimalPlaces
        return scalar(Math.round(value * factor) / factor)
      }
      case 'date_difference': {
        const start = child(node.start), end = child(node.end)
        return calendarDate(start) && calendarDate(end) && ['days', 'months', 'years'].includes(node.unit) ? dateDifference(start, end, node.unit) : null
      }
      case 'add': case 'subtract': case 'multiply': case 'divide': {
        const left = child(node.left), right = child(node.right)
        if (typeof left !== 'number' || typeof right !== 'number' || (node.kind === 'divide' && right === 0)) return null
        return scalar(node.kind === 'add' ? left + right : node.kind === 'subtract' ? left - right : node.kind === 'multiply' ? left * right : left / right)
      }
      default: return null
    }
  }
  for (const calculation of calculations) resolve(calculation.id)
  return result
}
