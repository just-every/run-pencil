import type { BuilderDraft } from '../../../app/api'
import type { ConditionTrace as Trace } from '../../../shared/conditions'
import { operatorLabels } from './ConditionEditor'
export function ConditionTrace({ trace, draft }: { trace: Trace; draft: BuilderDraft }) {
  const node = trace.condition
  if (node.kind === 'group') return <li>{node.join.toUpperCase()} group: {trace.matched ? 'true' : 'false'}<ul>{trace.children?.map((child, index) => <ConditionTrace key={index} trace={child} draft={draft}/>)}</ul></li>
  const value = trace.value === null || trace.value === undefined ? 'blank' : typeof trace.value === 'string' ? draft.choices.find(choice => choice.id === trace.value)?.label ?? trace.value : JSON.stringify(trace.value)
  return <li>{draft.steps.find(step => step.id === node.stepId)?.prompt}: {value} · {operatorLabels[node.operator]} → {trace.matched ? 'true' : 'false'}</li>
}
