import { remapCalculations } from '../../shared/calculationRemap'
import { formSettings, type FormSettings } from '../../shared/hiddenFields'
import { remapLayoutSettings } from '../../shared/screenLayout'
import { remapCondition } from '../../shared/conditions'
import { ulid } from 'ulid'
import { NotFoundError, ValidationError } from '../../shared/errors'
import type { FlowRepository } from './repository'
import type { FlowStructure } from './structure'
import { remapAnswerRecall } from '../../shared/answerRecall'
import { remapChoiceSettings } from '../../shared/otherChoices'

type Content = Pick<FlowStructure, 'steps' | 'choices' | 'rules'> & {formSettings?:FormSettings}

// Templates contain only builder content. No source flow/revision, audience,
// response, credential, delivery or external-provider identifier is retained.
function copyContent(source: Content, revisionId: string, now: string): Content {
  const steps = source.steps ?? [], choices = source.choices ?? [], rules = source.rules ?? []
  const settings = source.formSettings ?? {hiddenFields:[],identityMode:'anonymous' as const}
  const variables = new Map((settings.calculations ?? []).map(value=>[value.id,ulid()]))
  const fields = new Map(settings.hiddenFields.map(field=>[field.id,ulid()]))
  const ids = new Map([...steps.map(s => [s.stableId, ulid()] as [string,string]),...[...fields].map(([old,id])=>[`hidden:${old}`,`hidden:${id}`] as [string,string]),...[...variables].map(([old,id])=>[`variable:${old}`,`variable:${id}`] as [string,string])])
  const rows = new Map(steps.map(s => [s.id, ulid()]))
  const choiceIds = new Map(choices.map(c => [c.stableId, ulid()]))
  const expected = (value: unknown): unknown => typeof value === 'string' ? choiceIds.get(value) ?? value
    : Array.isArray(value) ? value.map(expected)
    : value && typeof value === 'object' && 'choiceId' in value ? { ...value, choiceId: choiceIds.get(String(value.choiceId)) ?? value.choiceId } : value
  return {
    formSettings:{...settings,calculations:remapCalculations(settings.calculations ?? [],ids,fields,variables,choiceIds),hiddenFields:settings.hiddenFields.map(field=>({...field,id:fields.get(field.id)!}))},
    steps: steps.map(s => ({ id: rows.get(s.id)!, stableId: ids.get(s.stableId)!, revisionId, position: s.position, kind: s.kind, questionType: s.questionType,
      prompt: remapAnswerRecall(s.prompt, ids), helperText: s.helperText ? remapAnswerRecall(s.helperText, ids) : null, required: s.required,
      nextStepStableId: s.nextStepStableId ? ids.get(s.nextStepStableId)! : null, questionSettingsJson: remapLayoutSettings(remapChoiceSettings(s.questionSettingsJson ?? null, choiceIds), ids, choiceIds), createdAt: now, updatedAt: now })),
    choices: choices.map(c => ({ id: ulid(), stableId: choiceIds.get(c.stableId)!, stepId: rows.get(c.stepId)!, value: c.value, label: remapAnswerRecall(c.label, ids), position: c.position, createdAt: now, updatedAt: now })),
    rules: rules.map(r => ({ id: ulid(), revisionId, sourceStepStableId: ids.get(r.sourceStepStableId)!, destinationStepStableId: ids.get(r.destinationStepStableId)!, predicateKind: r.predicateKind,
      expectedValueJson: JSON.stringify(expected(JSON.parse(r.expectedValueJson))), conditionJson: r.conditionJson ? JSON.stringify(remapCondition(JSON.parse(r.conditionJson), ids, choiceIds)) : null, position: r.position, createdAt: now, updatedAt: now })),
  }
}

export class TeamTemplates {
  constructor(private readonly db: D1Database, private readonly flows: FlowRepository) {}
  async list(workspaceId: string) {
    return (await this.db.prepare(`SELECT t.id,t.name,t.created_at AS createdAt,o.display_name AS createdBy FROM team_templates t LEFT JOIN operators o ON o.id=t.created_by WHERE t.workspace_id=? AND t.retired_at IS NULL ORDER BY t.name,t.id`).bind(workspaceId).all<{id:string;name:string;createdAt:string;createdBy:string|null}>()).results
  }
  async save(input: {workspaceId:string;operatorId:string;flowId:string;name:string;source:'draft'|'published';expectedVersion:number}) {
    const flow = await this.flows.findWorkspaceFlow(input.flowId,input.workspaceId)
    if (!flow) throw new NotFoundError('This flow does not exist.')
    const revision = input.source === 'draft' ? await this.flows.findRevision(flow.id,'draft') : await this.flows.findCurrentPublishedRevision(flow.id)
    if (!revision) throw new NotFoundError('This flow has no matching version to save.')
    const steps = await this.flows.getSteps(revision.id), choices = await this.flows.getChoices(steps.map(s => s.id)), rules = await this.flows.getBranchRules(revision.id)
    const id = ulid(), now = new Date().toISOString()
    const content = copyContent({steps,choices,rules,formSettings:formSettings(revision.formSettingsJson)},ulid(),now)
    const saved = await this.db.prepare(`INSERT INTO team_templates (id,workspace_id,name,structure_json,created_by,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM flows WHERE id=? AND workspace_id=? AND draft_version=?) RETURNING id`).bind(id,input.workspaceId,input.name,JSON.stringify(content),input.operatorId,now,flow.id,input.workspaceId,input.expectedVersion).first()
    if (!saved) throw new ValidationError('The flow changed. Reload it before saving a template.')
    return {id,name:input.name}
  }
  async retire(workspaceId:string,id:string) {
    const row = await this.db.prepare('UPDATE team_templates SET retired_at=? WHERE id=? AND workspace_id=? AND retired_at IS NULL RETURNING id').bind(new Date().toISOString(),id,workspaceId).first()
    if (!row) throw new NotFoundError('This template is not available.')
  }
  async create(input:{workspaceId:string;templateId:string;title:string;slug:string}) {
    const template = await this.db.prepare('SELECT structure_json AS content FROM team_templates WHERE id=? AND workspace_id=? AND retired_at IS NULL').bind(input.templateId,input.workspaceId).first<{content:string}>()
    if (!template) throw new NotFoundError('This template is not available.')
    const title=input.title.trim(), slug=input.slug.trim().toLowerCase()
    if (!title || title.length>200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>120) throw new ValidationError('Enter a flow name and a valid public link.')
    const id=ulid(), revisionId=ulid(), now=new Date().toISOString()
    const content=copyContent(JSON.parse(template.content) as Content,revisionId,now)
    const created=await this.flows.createStructure({
      flow:{id,workspaceId:input.workspaceId,title,slug,status:'draft',draftVersion:0,lastActivityAt:now,createdAt:now,updatedAt:now},
      revision:{formSettingsJson:JSON.stringify(content.formSettings),id:revisionId,flowId:id,number:1,state:'draft',title,publishedAt:null,isCurrent:false,createdAt:now,updatedAt:now},
      ...content,
    })
    if (!created) throw new ValidationError('That flow link is already in use.')
    return {id,title,slug}
  }
}
