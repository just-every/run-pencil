import type { BuilderDraft } from '../../app/api'
import { layoutSettingsValid, screenLayout, type ScreenLayout } from '../../shared/screenLayout'
import { structureLimitIssue } from '../../shared/formLimits'
import { ValidationError } from '../../shared/errors'

export function screenChanges(draft: BuilderDraft, stepId:string, layout:ScreenLayout|null) {
  const anchor = draft.steps.find(step => step.id === stepId)
  if (!anchor || anchor.kind !== 'question') throw new ValidationError('Choose the first question of this page or group.')
  const settings = {...anchor.questionSettings}
  if (!layout) { delete settings.screen; return [{id:stepId,settings,nextStepId:anchor.nextStepId}] }
  if (!layoutSettingsValid({screen:layout}) || layout.questionIds[0] !== stepId) throw new ValidationError('Choose a title and consecutive questions for this screen.')
  const members = layout.questionIds.map(id => draft.steps.find(step => step.id === id))
  for (const [index,member] of members.entries()) {
    if (!member || member.kind !== 'question' || member.position !== anchor.position+index) throw new ValidationError('A page or group contains consecutive questions only.')
    if (index > 0 && screenLayout(member) || draft.steps.some(step => step.id !== stepId && screenLayout(step)?.questionIds.includes(member.id))) throw new ValidationError('Pages and groups cannot overlap or nest.')
    if (index < members.length-1 && draft.branchRules.some(rule => rule.sourceStepId === member.id)) throw new ValidationError('Move answer paths to the last question before combining these questions.')
  }
  settings.screen=layout
  const capacityIssue=structureLimitIssue(draft.steps.map(step=>step.id===anchor.id?{...step,questionSettings:settings}:step))
  if(capacityIssue)throw new ValidationError(capacityIssue)
  return members.map((member,index) => ({id:member!.id,settings:index===0?settings:member!.questionSettings,nextStepId:index<members.length-1?members[index+1]!.id:member!.nextStepId}))
}
