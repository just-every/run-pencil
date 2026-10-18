import { calculationLimits, evaluateCalculations, type Calculation, type CalculationExpression } from './calculations'
import type { CalculationQuestion } from './calculationValidation'
import { ratingScale, ratingSettingsValid } from './ratingScale'
import { scoreOptions } from './scoreQuestions'

type Interval = readonly [number, number]
const interval = (min: unknown, max: unknown): Interval | undefined =>
  typeof min === 'number' && typeof max === 'number' && Number.isFinite(min) && Number.isFinite(max) && min <= max ? [min, max] : undefined
const excludesZero = (range: Interval | undefined): range is Interval => !!range && (range[0] > 0 || range[1] < 0)

function questionInterval(question: CalculationQuestion | undefined): Interval | undefined {
  if (!question) return undefined
  const settings = question.questionSettings ?? {}
  if (question.questionType === 'number') return interval(settings.min, settings.max)
  if (question.questionType === 'rating') {
    if (!ratingSettingsValid(settings)) return undefined
    const scale = ratingScale(settings)
    return [scale.min, scale.max]
  }
  if (question.questionType === 'nps') return [0, 10]
  const scores = scoreOptions(question.questionType ?? '').map(option => option.value).filter((value): value is number => typeof value === 'number')
  return scores.length ? interval(Math.min(...scores), Math.max(...scores)) : undefined
}

/** A bounded proof over every branch; unknown operands never establish safety. */
export function divisionDenominatorProof(definitions: ReadonlyMap<string, Calculation>, questions: ReadonlyMap<string, CalculationQuestion>) {
  const cache = new Map<CalculationExpression, Interval | undefined>()
  const active = new Set<string>()
  let budget = calculationLimits.perRevision * calculationLimits.expressionNodes * 2
  const range = (node: CalculationExpression, depth = 0): Interval | undefined => {
    if (cache.has(node)) return cache.get(node)
    if (--budget < 0 || depth > calculationLimits.perRevision * calculationLimits.expressionDepth) return undefined
    const child = (value: CalculationExpression) => range(value, depth + 1)
    let result: Interval | undefined
    switch (node.kind) {
      case 'literal': result = interval(node.value, node.value); break
      case 'answer': result = questionInterval(questions.get(node.stepId)); break
      case 'hidden': break
      case 'variable': {
        const definition = definitions.get(node.variableId)
        if (!definition || active.has(definition.id)) break
        active.add(definition.id)
        result = child(definition.expression)
        active.delete(definition.id)
        break
      }
      case 'conditional': {
        const left = child(node.then), right = child(node.else)
        if (left && right) result = interval(Math.min(left[0], right[0]), Math.max(left[1], right[1]))
        break
      }
      case 'round': {
        const value = child(node.value), factor = 10 ** node.decimalPlaces
        if (value) result = interval(Math.round(value[0] * factor) / factor, Math.round(value[1] * factor) / factor)
        break
      }
      case 'date_difference': {
        if (node.start.kind !== 'literal' || node.end.kind !== 'literal') break
        const value = evaluateCalculations([{ id: 'constant', name: 'constant', type: 'number', expression: node }], {}, {}).constant
        result = interval(value, value)
        break
      }
      default: {
        const left = child(node.left), right = child(node.right)
        if (!left || !right) break
        if (node.kind === 'add') result = interval(left[0] + right[0], left[1] + right[1])
        else if (node.kind === 'subtract') result = interval(left[0] - right[1], left[1] - right[0])
        else if (node.kind === 'multiply' || excludesZero(right)) {
          const values = left.flatMap(a => right.map(b => node.kind === 'multiply' ? a * b : a / b))
          result = interval(Math.min(...values), Math.max(...values))
        }
      }
    }
    cache.set(node, result)
    return result
  }
  return (denominator: CalculationExpression): boolean => excludesZero(range(denominator))
}
