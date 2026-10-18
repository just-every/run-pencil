import { remapCondition } from './conditions'
import type { Calculation, CalculationExpression } from './calculations'

/** Empty maps retain stable IDs for revisions; copies supply the allocated IDs. */
export function remapCalculations(calculations: readonly Calculation[], steps: ReadonlyMap<string, string>, fields: ReadonlyMap<string, string>, variables: ReadonlyMap<string, string>, choices: ReadonlyMap<string, string> = new Map()): Calculation[] {
  const operands = new Map(steps)
  for (const [before, after] of fields) operands.set(`hidden:${before}`, `hidden:${after}`)
  for (const [before, after] of variables) operands.set(`variable:${before}`, `variable:${after}`)
  const expression = (node: CalculationExpression): CalculationExpression => {
    switch (node.kind) {
      case 'literal': return { ...node }
      case 'answer': return { ...node, stepId: steps.get(node.stepId) ?? node.stepId }
      case 'hidden': return { ...node, fieldId: fields.get(node.fieldId) ?? node.fieldId }
      case 'variable': return { ...node, variableId: variables.get(node.variableId) ?? node.variableId }
      case 'conditional': return { ...node, condition: remapCondition(node.condition, operands, choices), then: expression(node.then), else: expression(node.else) }
      case 'round': return { ...node, value: expression(node.value) }
      case 'date_difference': return { ...node, start: expression(node.start), end: expression(node.end) }
      default: return { ...node, left: expression(node.left), right: expression(node.right) }
    }
  }
  return calculations.map(calculation => ({ ...calculation, id: variables.get(calculation.id) ?? calculation.id, expression: expression(calculation.expression) }))
}
