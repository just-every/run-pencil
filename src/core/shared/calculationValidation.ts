import type { ChoiceOption, FlowStep } from '../app/api'
import { conditionShape, conditionValueValid } from './conditionValidation'
import { conditionTests } from './conditions'
import { calculationLimits, type Calculation, type CalculationExpression } from './calculations'
import { calendarDate } from './questionTypes'
import { divisionDenominatorProof } from './calculationDivision'
import type { QuestionType } from './questionKinds'

export type CalculationQuestion = { id: string; questionType: string | null; questionSettings?: Record<string, unknown> | null }
export type CalculationHiddenField = { id: string; type: 'text' | 'number' | 'email' | 'date' | 'boolean' }
export type CalculationValidationError = {
  calculationId: string | null
  path: string
  code: 'shape' | 'limit' | 'duplicate' | 'missing_reference' | 'type_mismatch' | 'division_by_zero' | 'cycle'
  message: string
}
type ValueType = 'number' | 'text' | 'date' | 'boolean' | 'unsupported'
const idValid = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key))

function expressionShape(value: unknown, depth = 0, size = { count: 0, limited: false }): value is CalculationExpression {
  if (depth > calculationLimits.expressionDepth || ++size.count > calculationLimits.expressionNodes) { size.limited = true; return false }
  if (!record(value)) return false
  const child = (item: unknown) => expressionShape(item, depth + 1, size)
  switch (value.kind) {
    case 'literal': return keys(value, ['kind', 'value']) && ((typeof value.value === 'number' && Number.isFinite(value.value)) || (typeof value.value === 'string' && value.value.length <= calculationLimits.textCharacters))
    case 'answer': return keys(value, ['kind', 'stepId']) && idValid(value.stepId)
    case 'hidden': return keys(value, ['kind', 'fieldId']) && idValid(value.fieldId)
    case 'variable': return keys(value, ['kind', 'variableId']) && idValid(value.variableId)
    case 'add': case 'subtract': case 'multiply': case 'divide': return keys(value, ['kind', 'left', 'right']) && child(value.left) && child(value.right)
    case 'conditional': return keys(value, ['kind', 'condition', 'then', 'else']) && conditionShape(value.condition) && child(value.then) && child(value.else)
    case 'round': return keys(value, ['kind', 'value', 'decimalPlaces']) && Number.isInteger(value.decimalPlaces) && Number(value.decimalPlaces) >= 0 && Number(value.decimalPlaces) <= calculationLimits.decimalPlaces && child(value.value)
    case 'date_difference': return keys(value, ['kind', 'start', 'end', 'unit']) && ['days', 'months', 'years'].includes(String(value.unit)) && child(value.start) && child(value.end)
    default: return false
  }
}

export function calculationsShape(value: unknown): value is Calculation[] {
  return Array.isArray(value) && value.length <= calculationLimits.perRevision && value.every(item => record(item) && keys(item, ['id', 'name', 'type', 'expression']) && idValid(item.id) && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 100 && ['number', 'text'].includes(String(item.type)) && expressionShape(item.expression))
}

function questionValueType(type: string | null): ValueType {
  if (['number', 'rating', 'nps', 'csat', 'ces', 'emoji_rating'].includes(type ?? '')) return 'number'
  if (['short_text', 'long_text', 'email', 'url', 'single_choice', 'dropdown'].includes(type ?? '')) return 'text'
  if (type === 'date') return 'date'
  if (['yes_no', 'consent', 'thumbs_rating'].includes(type ?? '')) return 'boolean'
  return 'unsupported'
}

/** Validate every branch, including unselected conditional arms and variable dependencies. */
export function validateCalculations(value: unknown, questions: readonly CalculationQuestion[], hiddenFields: readonly CalculationHiddenField[], choices: ChoiceOption[] = []): CalculationValidationError[] {
  if (!calculationsShape(value)) {
    let limited = Array.isArray(value) && value.length > calculationLimits.perRevision
    if (Array.isArray(value) && !limited) for (const item of value) {
      const size = { count: 0, limited: false }
      if (record(item)) expressionShape(item.expression, 0, size)
      limited ||= size.limited
    }
    return [{ calculationId: null, path: 'calculations', code: limited ? 'limit' : 'shape', message: `Calculations must have valid typed expressions within ${calculationLimits.perRevision} variables, ${calculationLimits.expressionNodes} expression nodes and ${calculationLimits.expressionDepth} levels.` }]
  }
  const errors: CalculationValidationError[] = []
  const definitions = new Map(value.map(item => [item.id, item]))
  const questionMap = new Map(questions.map(item => [item.id, item]))
  const fieldMap = new Map(hiddenFields.map(item => [item.id, item]))
  const dependencies = new Map<string, Set<string>>()
  const denominatorSafe = divisionDenominatorProof(definitions, questionMap)
  const error = (calculation: Calculation, path: string, code: CalculationValidationError['code'], message: string) => errors.push({ calculationId: calculation.id, path, code, message: `${calculation.name}: ${message}` })
  const reference = (calculation: Calculation, kind: 'answer' | 'hidden' | 'variable', id: string, path: string): ValueType => {
    if (kind === 'answer') {
      const question = questionMap.get(id)
      if (question) return questionValueType(question.questionType)
    } else if (kind === 'hidden') {
      const field = fieldMap.get(id)
      if (field) return field.type === 'email' ? 'text' : field.type
    } else {
      dependencies.get(calculation.id)!.add(id)
      const variable = definitions.get(id)
      if (variable) return variable.type
    }
    error(calculation, path, 'missing_reference', `Missing or deleted ${kind} reference “${id}”.`)
    return 'unsupported'
  }
  const infer = (calculation: Calculation, node: CalculationExpression, path: string): ValueType => {
    const expect = (child: CalculationExpression, key: string, type: ValueType) => {
      const actual = infer(calculation, child, `${path}.${key}`)
      if (actual !== type) error(calculation, `${path}.${key}`, 'type_mismatch', `Expected ${type}, received ${actual}.`)
    }
    switch (node.kind) {
      case 'literal': return typeof node.value === 'number' ? 'number' : calendarDate(node.value) ? 'date' : 'text'
      case 'answer': return reference(calculation, 'answer', node.stepId, path)
      case 'hidden': return reference(calculation, 'hidden', node.fieldId, path)
      case 'variable': return reference(calculation, 'variable', node.variableId, path)
      case 'conditional': {
        for (const [index, test] of conditionTests(node.condition).entries()) {
          const conditionPath = `${path}.condition[${index}]`
          const kind = test.stepId.startsWith('hidden:') ? 'hidden' : test.stepId.startsWith('variable:') ? 'variable' : 'answer'
          const id = kind === 'answer' ? test.stepId : test.stepId.slice(test.stepId.indexOf(':') + 1)
          const type = reference(calculation, kind, id, conditionPath)
          const questionType = kind === 'answer' ? questionMap.get(id)?.questionType : type === 'text' ? 'short_text' : type === 'boolean' ? 'yes_no' : type
          const step: FlowStep = { id: test.stepId, questionType: (questionType ?? null) as QuestionType | null, position: 0, kind: 'question', prompt: '', helperText: null, required: false, nextStepId: null, questionSettings: null }
          if (!conditionValueValid(test, step, choices)) error(calculation, conditionPath, 'type_mismatch', `Condition operator or value does not fit “${test.stepId}”.`)
        }
        const left = infer(calculation, node.then, `${path}.then`), right = infer(calculation, node.else, `${path}.else`)
        if (left === right) return left
        if (['text', 'date'].includes(left) && ['text', 'date'].includes(right)) return 'text'
        error(calculation, path, 'type_mismatch', 'Conditional branches must return the same type.')
        return 'unsupported'
      }
      case 'round': expect(node.value, 'value', 'number'); return 'number'
      case 'date_difference': expect(node.start, 'start', 'date'); expect(node.end, 'end', 'date'); return 'number'
      default: {
        expect(node.left, 'left', 'number'); expect(node.right, 'right', 'number')
        if (node.kind === 'divide' && !denominatorSafe(node.right)) error(calculation, `${path}.right`, 'division_by_zero', 'Division requires a bounded denominator that is always above or below zero.')
        return 'number'
      }
    }
  }
  const ids = new Set<string>(), names = new Set<string>()
  for (const calculation of value) {
    if (ids.has(calculation.id)) error(calculation, 'id', 'duplicate', `Duplicate variable ID “${calculation.id}”.`)
    const name = calculation.name.trim().normalize('NFC').toLowerCase()
    if (names.has(name)) error(calculation, 'name', 'duplicate', `Duplicate variable name “${calculation.name}”.`)
    ids.add(calculation.id); names.add(name)
    dependencies.set(calculation.id, new Set())
    const type = infer(calculation, calculation.expression, 'expression')
    if (type !== calculation.type && !(calculation.type === 'text' && type === 'date')) error(calculation, 'expression', 'type_mismatch', `Expression returns ${type}; variable is ${calculation.type}.`)
  }
  const visited = new Set<string>(), active = new Set<string>(), cyclic = new Set<string>()
  const visit = (id: string) => {
    if (active.has(id)) { const path = [...active]; for (const member of path.slice(path.indexOf(id))) cyclic.add(member); return }
    if (visited.has(id)) return
    active.add(id)
    for (const dependency of dependencies.get(id) ?? []) visit(dependency)
    active.delete(id); visited.add(id)
  }
  for (const calculation of value) visit(calculation.id)
  for (const id of cyclic) error(definitions.get(id)!, 'expression', 'cycle', 'Variable references form a cycle.')
  return errors
}
