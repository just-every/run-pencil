import { conditionTests } from './conditions'
import type { Calculation, CalculationExpression } from './calculations'
import type { FlowStep } from '../app/api'

export function calculationInputs(calculations: readonly Calculation[], id: string) {
  const answers = new Set<string>(), hidden = new Set<string>(), variables = new Set<string>()
  const variable = (id: string) => {
    if (variables.has(id)) return
    variables.add(id)
    const definition = calculations.find(item=>item.id===id)
    if (definition) expression(definition.expression)
  }
  const operand = (id: string) => id.startsWith('hidden:') ? hidden.add(id.slice(7)) : id.startsWith('variable:') ? variable(id.slice(9)) : answers.add(id)
  const expression = (node: CalculationExpression): void => {
    switch(node.kind) {
      case 'literal': return
      case 'answer': answers.add(node.stepId); return
      case 'hidden': hidden.add(node.fieldId); return
      case 'variable': variable(node.variableId); return
      case 'conditional': conditionTests(node.condition).forEach(test=>operand(test.stepId)); expression(node.then); expression(node.else); return
      case 'round': expression(node.value); return
      case 'date_difference': expression(node.start); expression(node.end); return
      default: expression(node.left); expression(node.right)
    }
  }
  variable(id)
  return {answers,hidden,variables}
}

export function calculationOperands(calculations: readonly Calculation[]): FlowStep[] {
  return calculations.map(value=>({id:`variable:${value.id}`,position:-1,kind:'question',questionType:value.type==='number'?'number':'short_text',prompt:`Calculation: ${value.name}`,helperText:null,required:false,nextStepId:null,questionSettings:null}))
}
