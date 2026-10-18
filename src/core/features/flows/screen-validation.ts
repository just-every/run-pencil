import { screenLayout, visibilityCondition } from '../../shared/screenLayout'
import { conditionShape, conditionValueValid } from '../../shared/conditionValidation'
import { conditionTests } from '../../shared/conditions'
import { earlierRecallQuestions } from '../../shared/answerRecall'
import type { FlowGraph } from '../../shared/answerRecall'
import { formLimits } from '../../shared/formLimits'

export function validateScreens(flow: FlowGraph) {
  const issues: Array<{stepId:string;reason:string}> = []
  const owners = new Map<string,string>()
  const add = (stepId:string,reason:string) => issues.push({stepId,reason})
  for (const anchor of flow.steps) {
    const screen = screenLayout(anchor)
    if (!screen) continue
    if (anchor.kind !== 'question' || screen.questionIds[0] !== anchor.id || visibilityCondition(anchor)) add(anchor.id,'A page or group must start with its visible first question.')
    const members = screen.questionIds.map(id => flow.steps.find(step => step.id === id))
    for (const [index, member] of members.entries()) {
      if (!member || member.kind !== 'question') { add(anchor.id,'A page or group references a missing question.'); continue }
      if (owners.has(member.id)) add(member.id,'Pages and groups cannot overlap or nest.')
      owners.set(member.id,anchor.id)
      if (member.position !== anchor.position + index) add(member.id,'Page and group questions must be consecutive in display order.')
      if (index < members.length - 1 && (member.nextStepId !== screen.questionIds[index+1] || flow.branchRules.some(rule => rule.sourceStepId === member.id))) add(member.id,'Branch only after the last question on a page or group; connect its questions in order.')
      if (index > 0 && flow.steps.some(step => !screen.questionIds.includes(step.id) && step.nextStepId === member.id) || index > 0 && flow.branchRules.some(rule => rule.destinationStepId === member.id)) add(member.id,'A branch or default path must enter a page or group at its first question.')
    }
  }
  if (flow.steps.filter(step => step.kind !== 'question').length + flow.steps.filter(step => screenLayout(step)).length > formLimits.steps.structurePerRevision) add('flow','This form exceeds its configured screen limit.')
  for (const step of flow.steps) {
    const condition = visibilityCondition(step)
    if (!condition) continue
    if (!owners.has(step.id)) add(step.id,'Conditional visibility requires a page or group.')
    if (!conditionShape(condition)) { add(step.id,'This visibility condition exceeds the configured condition limits.'); continue }
    const earlier = new Set(earlierRecallQuestions(flow,step.id).filter(operand => operand.position < step.position).map(operand => operand.id))
    for (const [index,test] of conditionTests(condition).entries()) {
      const operand = flow.steps.find(candidate => candidate.id === test.stepId)
      if (!operand || !earlier.has(test.stepId) || !conditionValueValid(test,operand,flow.choices)) add(step.id,`Visibility condition ${index+1}: missing or later question, incompatible operator, or invalid stable choice.`)
    }
  }
  return issues
}
