import { answerIssue } from '../../shared/answers'
import { evaluateCalculations, type Calculation, type CalculationExpression } from '../../shared/calculations'
import { evaluateCondition, conditionTests, type Condition } from '../../shared/conditions'
import { hiddenFieldLimits, hiddenValue, type HiddenField } from '../../shared/hiddenFields'
import { scoreOptions, scoreQuestionTypes } from '../../shared/scoreQuestions'
import { textTypeLimit } from '../../shared/textValidation'
import { ConditionProofError, spendConditionProof, type ConditionQuestion, type ConditionProofBudget } from './condition-feasibility'

type Test = Extract<Condition, { kind: 'test' }>
type Requirement = { condition: Test; matched: boolean }
type DerivedRequirement = Requirement & { available: ReadonlySet<string> }
const normalized = (value: string) => value.trim().normalize('NFC').toLowerCase()
const textOperators = new Set(['equals', 'not_equals', 'is_blank', 'is_answered'])

function unsupported(question: ConditionQuestion, reason: string): never {
  throw new ConditionProofError(`Exact calculated-condition reachability for “${question.step.prompt}” exceeds the finite-domain limit: ${reason}.`)
}

/** A shared assignment preserves correlations between variables and path prefixes.
 * Domains are exhaustive finite values, or observational equality classes for
 * text. Unsupported domains refuse publication rather than approximating it.
 */
export function proveCalculatedConditions(
  calculations: Calculation[],
  questions: ReadonlyMap<string, ConditionQuestion>,
  derived: DerivedRequirement[],
  constraints: ReadonlyMap<string, Requirement[]>,
  visited: ReadonlySet<string>,
  budget: ConditionProofBudget,
): boolean {
  if (!derived.length) return true
  const definitions = new Map(calculations.map(calculation => [calculation.id, calculation]))
  const sources = new Set<string>(), variables = new Set<string>(), active = new Set<string>(), strings = new Set<string>()
  const inputTests = new Map<string, Test[]>()
  const stringsFrom = (value: unknown) => {
    if (typeof value === 'string') strings.add(value)
    else if (Array.isArray(value)) value.forEach(stringsFrom)
    else if (value && typeof value === 'object' && 'choiceId' in value) stringsFrom(value.choiceId)
  }
  const test = (condition: Test, collect: boolean) => {
    stringsFrom(condition.value)
    if (!collect) return
    if (condition.stepId.startsWith('variable:')) variable(condition.stepId.slice(9))
    else {
      sources.add(condition.stepId)
      inputTests.set(condition.stepId, [...inputTests.get(condition.stepId) ?? [], condition])
    }
  }
  const expression = (node: CalculationExpression, collect: boolean) => {
    spendConditionProof(budget)
    switch (node.kind) {
      case 'literal': stringsFrom(node.value); break
      case 'answer': if (collect) sources.add(node.stepId); break
      case 'hidden': if (collect) sources.add(`hidden:${node.fieldId}`); break
      case 'variable': if (collect) variable(node.variableId); break
      case 'conditional': conditionTests(node.condition).forEach(condition => test(condition, collect)); expression(node.then, collect); expression(node.else, collect); break
      case 'round': expression(node.value, collect); break
      case 'date_difference': expression(node.start, collect); expression(node.end, collect); break
      default: expression(node.left, collect); expression(node.right, collect)
    }
  }
  const variable = (id: string) => {
    const calculation = definitions.get(id)
    if (!calculation) throw new ConditionProofError(`A calculated condition references missing variable “${id}”.`)
    if (active.has(id)) throw new ConditionProofError(`Calculated condition variable “${calculation.name}” has a reference cycle.`)
    if (variables.has(id)) return
    active.add(id); expression(calculation.expression, true); active.delete(id); variables.add(id)
  }
  // Include constants outside the transitive closure too: a direct text return
  // can subsequently be compared with any literal or condition value.
  for (const calculation of calculations) expression(calculation.expression, false)
  for (const requirements of constraints.values()) for (const { condition } of requirements) test(condition, false)
  for (const { condition } of derived) {
    test(condition, false)
    if (!condition.stepId.startsWith('variable:')) throw new ConditionProofError('A derived condition must reference a calculated variable.')
    variable(condition.stepId.slice(9))
  }
  const relevant = calculations.filter(calculation => variables.has(calculation.id))
  const assignment: Record<string, unknown> = Object.create(null)
  const entries = [...sources].map(id => {
    const question = questions.get(id)
    if (!question) throw new ConditionProofError(`A calculation references missing source input “${id}”.`)
    // Inputs later than every tested prefix cannot affect any derived test.
    if (!visited.has(id) || !derived.some(requirement => requirement.available.has(id))) return [id, [undefined]] as const
    const requirements = constraints.get(id) ?? []
    const tests = [...requirements.map(requirement => requirement.condition), ...inputTests.get(id) ?? []]
    return [id, sourceDomain(id, question, requirements, tests, strings, budget)] as const
  })
  const witness = () => derived.every(({ condition, matched, available }) => {
    spendConditionProof(budget)
    const answers: Record<string, unknown> = Object.create(null), hidden: Record<string, unknown> = Object.create(null)
    for (const [id, value] of Object.entries(assignment)) if (available.has(id)) {
      if (id.startsWith('hidden:')) hidden[id.slice(7)] = value
      else answers[id] = value
    }
    const values = evaluateCalculations(relevant, answers, hidden)
    const calculated = Object.fromEntries(Object.entries(values).map(([id, value]) => [`variable:${id}`, value]))
    return evaluateCondition(condition, calculated).matched === matched
  })
  const search = (index: number): boolean => {
    if (index === entries.length) return witness()
    const [id, domain] = entries[index]
    for (const value of domain) {
      spendConditionProof(budget)
      assignment[id] = value
      if (search(index + 1)) return true
    }
    delete assignment[id]
    return false
  }
  return search(0)
}

function sourceDomain(id: string, question: ConditionQuestion, requirements: Requirement[], tests: Test[], strings: ReadonlySet<string>, budget: ConditionProofBudget): unknown[] {
  const { step, choices, settings } = question
  const hidden = id.startsWith('hidden:')
  const fieldType = step.questionType === 'yes_no' ? 'boolean' : ['short_text', 'long_text'].includes(step.questionType ?? '') ? 'text' : step.questionType
  const field: HiddenField = { id: id.slice(7), name: 'proof', type: fieldType as HiddenField['type'], category: fieldType === 'email' ? 'identifying' : 'plain' }
  const valid = (value: unknown) => value === undefined ? !step.required
    : hidden ? hiddenValue(field, value) === value
      : !answerIssue({ ...step, questionSettings: settings }, choices, value)
  const satisfies = (value: unknown) => requirements.every(({ condition, matched }) => evaluateCondition(condition, { [id]: value }).matched === matched)
  const present = (values: unknown[]) => [...(!step.required ? [undefined] : []), ...values].filter(value => {
    spendConditionProof(budget)
    return valid(value) && satisfies(value)
  })
  if (step.questionType === 'number') {
    if (hidden) unsupported(question, 'hidden numeric inputs are unbounded')
    const { min, max, decimalPlaces } = settings
    if (typeof min !== 'number' || typeof max !== 'number' || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || decimalPlaces !== 0 || max < min || max - min >= 1000) unsupported(question, 'numeric inputs need explicit safe integer min/max, zero decimal places and at most 1,000 values')
    return present(Array.from({ length: max - min + 1 }, (_, index) => min + index))
  }
  if (step.questionType === 'rating') {
    const min = settings.min ?? 1, max = settings.max ?? 5
    if (typeof min !== 'number' || typeof max !== 'number' || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min || max - min >= 1000) unsupported(question, 'rating values must have a finite valid range of at most 1,000 options')
    return present(Array.from({ length: max - min + 1 }, (_, index) => min + index))
  }
  if (step.questionType === 'nps') return present(Array.from({ length: 11 }, (_, index) => index))
  if ((scoreQuestionTypes as readonly string[]).includes(step.questionType ?? '')) return present(scoreOptions(step.questionType!).map(option => option.value))
  if (step.questionType === 'yes_no' || step.questionType === 'consent') return present([false, true])
  if (step.questionType === 'single_choice' || step.questionType === 'dropdown') {
    const other = settings.otherChoiceId
    if (typeof other === 'string' && choices.includes(other) && satisfies({ choiceIds: [other], otherText: 'proof' })) unsupported(question, 'an Other answer remains possible')
    return present(choices.filter(choice => choice !== other))
  }
  if (['short_text', 'long_text', 'email'].includes(step.questionType ?? '')) {
    if (settings.pattern !== undefined || settings.inputMask !== undefined) unsupported(question, 'text masks and patterns are not supported')
    if (tests.some(condition => !textOperators.has(condition.operator))) unsupported(question, 'text domains support only equality, inequality and blank/answered tests')
    return present(textClasses(question, strings, hidden, valid, budget))
  }
  unsupported(question, `${step.questionType ?? 'complex'} inputs do not have a supported finite domain`)
}

function textClasses(question: ConditionQuestion, strings: ReadonlySet<string>, hidden: boolean, valid: (value: unknown) => boolean, budget: ConditionProofBudget): string[] {
  const { step, settings } = question
  const email = step.questionType === 'email'
  const min = Math.max(email ? 5 : 1, Number(settings.minLength ?? 0))
  const max = hidden ? hiddenFieldLimits.textCharacters : email ? 200 : Number(settings.maxLength ?? textTypeLimit(step.questionType))
  if (min > max) return []
  const classes = new Map<string, string[]>()
  for (const value of strings) {
    const key = normalized(value)
    if (key) classes.set(key, [...classes.get(key) ?? [], value])
  }
  const values: string[] = []
  for (const [key, literals] of classes) {
    spendConditionProof(budget)
    const variants = [...literals, ...literals.map(value => value.trim().normalize('NFC')), key, key.toUpperCase().normalize('NFC')]
    if (!hidden && !email) variants.push(...variants.map(value => value + ' '.repeat(Math.max(0, min - value.length))))
    const representative = variants.find(value => normalized(value) === key && valid(value))
    if (representative !== undefined) values.push(representative)
    else if (key.length > max && !email) unsupported(question, 'a text equality class cannot be resolved exactly within its character limit')
  }
  // Enumerate distinct fixed-length strings until one is outside all named
  // classes. This is a witness search, not a sampled approximation; exhausting
  // the shared proof budget throws instead of concluding unsatisfiability.
  const width = email ? min - 4 : min
  for (let index = 0; ; index++) {
    spendConditionProof(budget)
    let remaining = index, value = ''
    for (let digit = 0; digit < width; digit++) { value = String.fromCharCode(remaining % 65536) + value; remaining = Math.floor(remaining / 65536) }
    if (remaining) unsupported(question, 'the unnamed text equivalence class needs a larger exact proof domain')
    if (email) value += '@a.b'
    if (valid(value) && !classes.has(normalized(value))) { values.push(value); break }
  }
  return values
}
