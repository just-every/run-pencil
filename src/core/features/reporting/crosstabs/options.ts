import { defaultPolicies } from '../../analysis'
import { isChoiceQuestion } from '../../../shared/choiceAnswers'
import { ratingScale } from '../../../shared/ratingScale'
import { scoreOptions } from '../../../shared/scoreQuestions'
import { typeSettingsValid } from '../../../shared/questionTypes'
import { NotFoundError, ValidationError } from '../../../shared/errors'
import { bucket, type CrossTabOptions, type DimensionOption } from './model'

export type Question = { id: string; stableId: string; prompt: string; type: string; settingsJson: string | null; required: number }
export type Option = { id: string; stepId: string; label: string }
export const categoricalTypes = ['single_choice','multiple_choice','dropdown','yes_no','consent','rating','nps','csat','ces','emoji_rating','thumbs_rating'] as const
export const categoricalType = (type: string) => (categoricalTypes as readonly string[]).includes(type)

export async function loadOptions(db: D1Database, workspaceId: string, flowId: string, revisionId: string) {
  const revision = await db.prepare(`SELECT f.id AS flowId,f.title,v.id,v.number,v.published_at AS publishedAt
    FROM flows f JOIN flow_revisions v ON v.flow_id=f.id WHERE f.workspace_id=? AND f.id=? AND v.id=? AND v.state='published'`)
    .bind(workspaceId, flowId, revisionId).first<{flowId:string;title:string;id:string;number:number;publishedAt:string}>()
  if (!revision) throw new NotFoundError('Choose a published revision of a form in your workspace.')
  const [questions, choices, collectors, policies] = await db.batch([
    db.prepare("SELECT id,stable_id AS stableId,prompt,question_type AS type,question_settings_json AS settingsJson,required FROM flow_steps WHERE revision_id=? AND kind='question' ORDER BY position").bind(revisionId),
    db.prepare('SELECT c.stable_id AS id,s.stable_id AS stepId,c.label FROM choice_options c JOIN flow_steps s ON s.id=c.step_id WHERE s.revision_id=? ORDER BY c.position').bind(revisionId),
    db.prepare('SELECT id,name FROM collectors WHERE flow_id=? ORDER BY created_at,id').bind(flowId),
    db.prepare('SELECT disclosure_threshold AS threshold FROM analysis_policies WHERE workspace_id=?').bind(workspaceId),
  ])
  const options = choices.results as Option[], source = questions.results as Question[]
  const dimensions: DimensionOption[] = source.filter(question => categoricalType(question.type)).map<DimensionOption>(question => {
    const settings: Record<string,unknown> = JSON.parse(question.settingsJson ?? '{}')
    if (!typeSettingsValid(question.type, settings)) throw new ValidationError('A published dimension has invalid question settings.')
    let buckets = options.filter(option => option.stepId === question.stableId).map(option => bucket(option.id,option.label))
    if (question.type === 'yes_no' || question.type === 'consent') buckets = [bucket(true, question.type === 'consent' ? 'Accepted' : 'Yes'), bucket(false, question.type === 'consent' ? 'Declined' : 'No')]
    if (['csat','ces','emoji_rating','thumbs_rating'].includes(question.type)) buckets = scoreOptions(question.type).map(option => bucket(option.value,option.label))
    if (question.type === 'nps') buckets = Array.from({length:11},(_,value)=>bucket(value,String(value)))
    if (question.type === 'rating') {
      const scale = ratingScale(settings)
      buckets = Array.from({length:scale.steps},(_,index)=> {
        const value=scale.min+index, label=value===scale.min?scale.lowLabel:value===scale.max?scale.highLabel:value===(scale.min+scale.max)/2?scale.middleLabel:''
        return bucket(value,label?`${value} · ${label}`:String(value))
      })
    }
    if (isChoiceQuestion(question.type) && !buckets.length) throw new ValidationError('A published choice dimension has no options.')
    return {dimension:{kind:'question',stepId:question.stableId},label:question.prompt,questionType:question.type,multiple:question.type==='multiple_choice',buckets}
  })
  dimensions.push({dimension:{kind:'collector'},label:'Collector',questionType:null,multiple:false,buckets:(collectors.results as Array<{id:string;name:string}>).map(collector=>bucket(collector.id,collector.name))})
  const threshold = (policies.results[0] as {threshold:number}|undefined)?.threshold ?? defaultPolicies.disclosureThreshold
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 1000) throw new ValidationError('The workspace disclosure threshold is invalid.')
  const result: CrossTabOptions = {flow:{id:flowId,title:revision.title},revision:{id:revision.id,number:revision.number,publishedAt:revision.publishedAt},dimensions,disclosureThreshold:threshold}
  return { result, questions:source, choices:options }
}
export async function dimensionOptions(db: D1Database, workspaceId: string, flowId: string, input: {revisionId:string}): Promise<CrossTabOptions> {
  return (await loadOptions(db,workspaceId,flowId,input.revisionId)).result
}
