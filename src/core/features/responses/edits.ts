import { formattedAnswer, interpolateAnswerRecall } from '../../shared/answerRecall'
import { FlowRepository, publicSteps, publicChoices, publicRules } from '../flows'
import { createDatabase } from '../../platform/db/repository'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { formSettings, hiddenAnswers, type ResponseContext } from '../../shared/hiddenFields'
import { revisionBranchSelection } from '../../shared/flowPolicies'
import { evaluateCalculations } from '../../shared/calculations'
import { paymentQuote, paymentSettings } from '../../shared/payments'
import { presentFlow } from '../../shared/presentationOrder'
import { validatePathAnswers, type AnswerInput } from './path'
import { storedAnswerValue, runtimeAnswerValue } from './answerStorage'

const hash = async (token:string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(value=>value.toString(16).padStart(2,'0')).join('')
/** Called only after RESP-020 has selected a permitted confirmation recipient. */
export async function confirmationEditLink(db:D1Database,responseId:string,deadline:string) {
 if(Date.parse(deadline)<=Date.now())return undefined
 const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')
 const inserted=await db.prepare(`INSERT INTO response_edit_links(hash,response_id,version,expires_at,created_at)
 SELECT ?,id,COALESCE((SELECT MAX(number) FROM response_versions WHERE response_id=r.id),1),?,? FROM responses r WHERE id=? AND state='released'`)
 .bind(await hash(token),deadline,new Date().toISOString(),responseId).run()
 return inserted.meta.changes?`/f/${(await db.prepare('SELECT slug FROM flows WHERE id=(SELECT flow_id FROM responses WHERE id=?)').bind(responseId).first<{slug:string}>())!.slug}?edit=${token}`:undefined
}
export class ResponseEdits {
 private flows:FlowRepository
 constructor(private db:D1Database){this.flows=new FlowRepository(createDatabase(db),db)}
 private async context(slug:string,token:string) {
  const tokenHash=await hash(token)
  const link=await this.db.prepare(`SELECT l.response_id AS responseId,l.version,l.expires_at AS expiresAt,l.used_claim AS usedClaim,r.revision_id AS revisionId,r.response_context_json AS contextJson,r.updated_at AS updatedAt,r.completed_at AS completedAt
   FROM response_edit_links l JOIN responses r ON r.id=l.response_id JOIN flows f ON f.id=r.flow_id JOIN flow_revisions v ON v.id=r.revision_id
   WHERE l.hash=? AND f.slug=? AND r.state='released' AND f.status='open' AND v.admission_closed_at IS NULL AND (v.deadline_at IS NULL OR v.deadline_at>?)`)
   .bind(tokenHash,slug,new Date().toISOString()).first<{responseId:string;version:number;expiresAt:string;usedClaim:string|null;revisionId:string;contextJson:string;updatedAt:string;completedAt:string}>()
  if(!link || link.usedClaim || link.expiresAt<=new Date().toISOString())throw new NotFoundError('This edit link has expired, was used, or its response is unavailable.')
  const revision=await this.flows.findRevisionById(link.revisionId)
  if(!revision)throw new NotFoundError('This response is unavailable.')
  const settings=formSettings(revision.formSettingsJson)
  if(!settings.responseEdits?.enabled || settings.responseEdits.deadline<=new Date().toISOString())throw new NotFoundError('The editing deadline has passed.')
  const graph=await this.flows.getRevisionGraph(link.revisionId)
  const answers=(await this.db.prepare('SELECT step_id AS stepId,value_json AS valueJson FROM response_answers WHERE response_id=? ORDER BY step_id').bind(link.responseId).all<{stepId:string;valueJson:string}>()).results
  return {tokenHash,link,revision,settings,graph,answers}
 }
 async read(slug:string,token:string) {
  const {link,revision,settings,graph,answers}=await this.context(slug,token)
  const context=JSON.parse(link.contextJson) as ResponseContext
  return {flow:presentFlow({flow:{id:revision.flowId,slug,title:revision.title},revision:{id:revision.id,number:revision.number,publishedAt:revision.publishedAt,deadlineAt:revision.deadlineAt,targetCompletedResponses:revision.targetCompletedResponses},steps:publicSteps(graph.steps),choices:publicChoices(graph.steps,graph.choices),branchRules:publicRules(graph.rules),formSettings:settings,hiddenContext:context,branchSelection:revisionBranchSelection(revision.policySnapshotJson),reviewBeforeSubmit:true}),answers:answers.map(answer=>({stepId:answer.stepId,value:runtimeAnswerValue(graph.steps.find(step=>step.stableId===answer.stepId),JSON.parse(answer.valueJson))})),deadline:link.expiresAt}
 }
 async submit(slug:string,token:string,answers:AnswerInput[]) {
  const {tokenHash,link,revision,settings,graph}=await this.context(slug,token)
  const context=JSON.parse(link.contextJson) as ResponseContext
  const path=validatePathAnswers(graph.steps,graph.choices,graph.rules,answers,revisionBranchSelection(revision.policySnapshotJson),hiddenAnswers(context),settings)
  const values=Object.fromEntries(path.accepted.map(answer=>[answer.stepId,answer.value]))
  context.calculations=evaluateCalculations(settings.calculations??[],values,context.hidden)
  const payment=await this.db.prepare('SELECT step_id AS stepId,amount FROM response_payments WHERE response_id=?').bind(link.responseId).first<{stepId:string;amount:number}>()
  if(payment || path.paymentStepId) {
   const step=publicSteps(graph.steps).find(step=>step.id===path.paymentStepId)
   const pricing=step && paymentSettings(step)
   const quote=pricing && paymentQuote(pricing,{steps:publicSteps(graph.steps),choices:publicChoices(graph.steps,graph.choices)},values,context.calculations,revision.title)
   if(!payment || payment.stepId!==path.paymentStepId || !quote || 'issue' in quote || quote.total!==payment.amount)throw new ValidationError('An edit cannot change the payable total. Payment state has not changed.')
  }
  const now=new Date().toISOString(),claim=crypto.randomUUID()
  const gate=`EXISTS(SELECT 1 FROM response_edit_links WHERE hash=? AND used_claim=?)`
  const statements=[
   this.db.prepare(`UPDATE response_edit_links SET used_claim=? WHERE hash=? AND used_claim IS NULL AND expires_at>? AND version=COALESCE((SELECT MAX(number) FROM response_versions WHERE response_id=response_edit_links.response_id),1)
    AND EXISTS(SELECT 1 FROM responses r JOIN flows f ON f.id=r.flow_id JOIN flow_revisions v ON v.id=r.revision_id WHERE r.id=response_edit_links.response_id AND r.updated_at=? AND r.state='released' AND f.status='open' AND v.admission_closed_at IS NULL AND (v.deadline_at IS NULL OR v.deadline_at>?))`).bind(claim,tokenHash,now,link.updatedAt,now),
   this.db.prepare(`INSERT OR IGNORE INTO response_versions(response_id,number,answers_json,context_json,created_at)
    SELECT r.id,1,(SELECT json_group_array(json_object('stepId',step_id,'value',json(value_json))) FROM response_answers WHERE response_id=r.id),response_context_json,completed_at FROM responses r WHERE id=? AND ${gate}`).bind(link.responseId,tokenHash,claim),
   this.db.prepare(`DELETE FROM response_answers WHERE response_id=? AND ${gate}`).bind(link.responseId,tokenHash,claim),
   ...path.accepted.map(answer=>this.db.prepare(`INSERT INTO response_answers(id,response_id,step_id,value_json,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE ${gate}`).bind(crypto.randomUUID(),link.responseId,answer.stepId,JSON.stringify(storedAnswerValue(graph.steps.find(step=>step.stableId===answer.stepId)!,answer.value)),now,now,tokenHash,claim)),
   this.db.prepare(`UPDATE responses SET response_context_json=?,updated_at=? WHERE id=? AND ${gate}`).bind(JSON.stringify(context),now,link.responseId,tokenHash,claim),
   this.db.prepare(`INSERT INTO response_versions(response_id,number,answers_json,context_json,created_at)
    SELECT id,?,(SELECT json_group_array(json_object('stepId',step_id,'value',json(value_json))) FROM response_answers WHERE response_id=r.id),response_context_json,? FROM responses r WHERE id=? AND ${gate}`).bind(link.version+1,now,link.responseId,tokenHash,claim),
  ]
  const result=await this.db.batch(statements)
  if(!result[0].meta.changes)throw new ValidationError('This edit link was used or the response changed. Your edit was refused.')
  return {responseId:link.responseId,completionStepId:path.completionStepId,version:link.version+1}
 }
 async versions(workspaceId:string,responseId:string) {
  const response=await this.db.prepare('SELECT id,revision_id AS revisionId FROM responses WHERE id=? AND workspace_id=?').bind(responseId,workspaceId).first<{id:string;revisionId:string}>()
  if(!response)throw new NotFoundError('This response is unavailable.')
  const rows=(await this.db.prepare(`SELECT number,answers_json AS answersJson,context_json AS contextJson,created_at AS createdAt FROM response_versions WHERE response_id=? ORDER BY number DESC LIMIT 100`).bind(responseId).all<{number:number;answersJson:string;contextJson:string;createdAt:string}>()).results
  const graph=await this.flows.getRevisionGraph(response.revisionId),revision=await this.flows.findRevisionById(response.revisionId)
  if(!revision)throw new NotFoundError('The published response form is unavailable.')
  return {versions:rows.map((row,index)=>{
   const answers=JSON.parse(row.answersJson) as AnswerInput[],context=JSON.parse(row.contextJson) as ResponseContext
   const flow={steps:publicSteps(graph.steps),choices:publicChoices(graph.steps,graph.choices),branchRules:publicRules(graph.rules),formSettings:formSettings(revision.formSettingsJson),hiddenContext:context,branchSelection:revisionBranchSelection(revision.policySnapshotJson)}
   const values=Object.fromEntries(answers.map(answer=>[answer.stepId,runtimeAnswerValue(graph.steps.find(step=>step.stableId===answer.stepId),answer.value)]))
   return {number:row.number,current:index===0,createdAt:row.createdAt,context,answers,displayAnswers:answers.map(answer=>{
    const step=flow.steps.find(step=>step.id===answer.stepId)
    if(!step)throw new ValidationError('A retained version refers to a missing question.')
    return {...answer,label:interpolateAnswerRecall(step.prompt,flow,values,step.id),displayValue:formattedAnswer(step,flow.choices.filter(choice=>choice.stepId===step.id),values[step.id],label=>interpolateAnswerRecall(label,flow,values,step.id))}
   })}
  })}
 }
}
