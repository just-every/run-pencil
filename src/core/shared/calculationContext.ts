import { evaluateCalculations } from './calculations'
import { hiddenAnswers, type FormSettings, type ResponseContext } from './hiddenFields'

export function variableAnswers(values: Record<string,number|string|null> = {}): Record<string,unknown> {
  return Object.fromEntries(Object.entries(values).map(([id,value])=>[`variable:${id}`,value]))
}
/** Never accepts submitted calculated values or off-path source answers. */
export function formAnswerContext(settings: FormSettings | undefined, accepted: Record<string,unknown>, context?: Pick<ResponseContext,'hidden'>) {
  const hidden = context?.hidden ?? {}
  const answers = Object.fromEntries(Object.entries(accepted).filter(([id])=>!id.startsWith('hidden:')&&!id.startsWith('variable:')))
  return {...answers,...hiddenAnswers({hidden}),...variableAnswers(evaluateCalculations(settings?.calculations ?? [],answers,hidden))}
}
