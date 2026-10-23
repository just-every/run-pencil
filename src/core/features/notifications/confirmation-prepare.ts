import { z } from 'zod'
import type { PublicFlow } from '../../app/api'
import { createDatabase } from '../../platform/db/repository'
import { formSettings, type ResponseContext } from '../../shared/hiddenFields'
import { revisionBranchSelection } from '../../shared/flowPolicies'
import { visiblePath } from '../../shared/flowPath'
import { answerIssue } from '../../shared/answers'
import { FlowRepository } from '../flows/repository'
import { publicSteps, publicChoices, publicRules } from '../flows/serialization'
import { runtimeAnswerValue } from '../responses/answerStorage'
import { readNotificationBrand } from './brand'
import { composeRespondentConfirmation } from './confirmation-compose'
import { serializeConfirmation } from './confirmation-message'
export type ConfirmationCandidate={id:string;workspaceId:string;revisionId:string;contextJson:string;settingsJson:string;policyJson:string|null;participantEmail:string|null}
export async function prepareConfirmation(db:D1Database,row:ConfirmationCandidate) {
 const repository=new FlowRepository(createDatabase(db),db)
 const [graph,revision,answers,brand]=await Promise.all([
  repository.getRevisionGraph(row.revisionId),repository.findRevisionById(row.revisionId),
  db.prepare('SELECT step_id AS stepId,value_json AS valueJson FROM response_answers WHERE response_id=?').bind(row.id).all<{stepId:string;valueJson:string}>(),
  readNotificationBrand(db,row.workspaceId),
 ])
 if(!revision) throw new Error('Missing published revision.')
 const settings=formSettings(row.settingsJson), confirmation=settings.confirmation
 if(!confirmation?.enabled) throw new Error('Confirmation is not enabled.')
 const context=JSON.parse(row.contextJson) as ResponseContext
 const values=Object.fromEntries(answers.results.map(answer=>[answer.stepId,runtimeAnswerValue(graph.steps.find(step=>step.stableId===answer.stepId),JSON.parse(answer.valueJson))]))
 const flow:PublicFlow={flow:{id:revision.flowId,slug:'',title:revision.title},revision:{id:revision.id,number:revision.number,publishedAt:revision.publishedAt,deadlineAt:revision.deadlineAt,targetCompletedResponses:revision.targetCompletedResponses},
  steps:publicSteps(graph.steps),choices:publicChoices(graph.steps,graph.choices),branchRules:publicRules(graph.rules),formSettings:settings,hiddenContext:context,branchSelection:revisionBranchSelection(row.policyJson)}
 const path=visiblePath(flow,values), completion=path.at(-1)
 if(completion?.kind!=='completion') throw new Error('Retained response has no completion.')
 let recipient:unknown=row.participantEmail
 if(confirmation.emailStepId) {
  const step=path.find(step=>step.id===confirmation.emailStepId && step.kind==='question' && step.questionType==='email')
  if(!step || answerIssue(step,[],values[step.id])) return null
  recipient=values[step.id]
  if(['unchanged','locked'].includes(context.prefill?.[step.id]??'') && recipient!==row.participantEmail)return null
 }
 const mailbox=z.email().safeParse(recipient)
 if(!mailbox.success) return null
 const suppressed=await db.prepare(`SELECT 1 FROM distribution_contacts WHERE workspace_id=? AND lower(email)=lower(?) AND opted_out_at IS NOT NULL
 UNION ALL SELECT 1 FROM invitation_participants WHERE workspace_id=? AND lower(email_snapshot)=lower(?) AND delivery_status='bounced' LIMIT 1`)
  .bind(row.workspaceId,mailbox.data,row.workspaceId,mailbox.data).first()
 if(suppressed)return null
 const accepted=Object.fromEntries(path.filter(step=>step.kind==='question' && Object.hasOwn(values,step.id) && !answerIssue(step,flow.choices.filter(choice=>choice.stepId===step.id).map(choice=>choice.id),values[step.id])).map(step=>[step.id,values[step.id]]))
 const message=composeRespondentConfirmation({brand,flow,answers:accepted,completionStepId:completion.id,settings:confirmation})
 return {recipient:mailbox.data,messageJson:serializeConfirmation(message)}
}
