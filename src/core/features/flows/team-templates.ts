import { remapConfirmationSettings } from '../../shared/confirmationSettings'
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
import type { LinkPreviewAssetStore } from '../../shared/linkPreview'

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
    formSettings:{...settings,...(settings.prefill?{prefill:settings.prefill.map(mapping=>({...mapping,stepId:ids.get(mapping.stepId)??mapping.stepId}))}:{}),...(settings.confirmation?{confirmation:remapConfirmationSettings(settings.confirmation,ids)}:{}),calculations:remapCalculations(settings.calculations ?? [],ids,fields,variables,choiceIds),hiddenFields:settings.hiddenFields.map(field=>({...field,id:fields.get(field.id)!}))},
    steps: steps.map(s => ({ id: rows.get(s.id)!, stableId: ids.get(s.stableId)!, revisionId, position: s.position, kind: s.kind, questionType: s.questionType,
      prompt: remapAnswerRecall(s.prompt, ids), helperText: s.helperText ? remapAnswerRecall(s.helperText, ids) : null, required: s.required,
      nextStepStableId: s.nextStepStableId ? ids.get(s.nextStepStableId)! : null, questionSettingsJson: remapLayoutSettings(remapChoiceSettings(s.questionSettingsJson ?? null, choiceIds), ids, choiceIds), createdAt: now, updatedAt: now })),
    choices: choices.map(c => ({ id: ulid(), stableId: choiceIds.get(c.stableId)!, stepId: rows.get(c.stepId)!, value: c.value, label: remapAnswerRecall(c.label, ids), position: c.position, createdAt: now, updatedAt: now })),
    rules: rules.map(r => ({ id: ulid(), revisionId, sourceStepStableId: ids.get(r.sourceStepStableId)!, destinationStepStableId: ids.get(r.destinationStepStableId)!, predicateKind: r.predicateKind,
      expectedValueJson: JSON.stringify(expected(JSON.parse(r.expectedValueJson))), conditionJson: r.conditionJson ? JSON.stringify(remapCondition(JSON.parse(r.conditionJson), ids, choiceIds)) : null, position: r.position, createdAt: now, updatedAt: now })),
  }
}

export class TeamTemplates {
  constructor(private readonly db: D1Database, private readonly flows: FlowRepository, private readonly previewAssets?: LinkPreviewAssetStore, private readonly attribution: Record<string, unknown> = {}) {}
  attributed(attribution: Record<string, unknown>) { return new TeamTemplates(this.db, this.flows.attributed(attribution), this.previewAssets, attribution) }
  async current(workspaceId: string, id: string) {
    const row = await this.db.prepare('SELECT id,name,created_at AS createdAt,retired_at AS retiredAt FROM team_templates WHERE workspace_id=? AND id=?').bind(workspaceId,id).first<{id:string;name:string;createdAt:string;retiredAt:string|null}>()
    if (!row) throw new NotFoundError('This template is not available.')
    return row
  }
  async list(workspaceId: string) {
    return (await this.db.prepare(`SELECT t.id,t.name,t.created_at AS createdAt,CASE WHEN json_type(a.details_json,'$.prepared_by.agent.name')='text' THEN json_extract(a.details_json,'$.prepared_by.agent.name') || ' for ' || o.display_name ELSE o.display_name END AS createdBy FROM team_templates t LEFT JOIN operators o ON o.id=t.created_by LEFT JOIN audit_entries a ON a.subject_type='team-template' AND a.subject_id=t.id AND a.kind='template.saved' WHERE t.workspace_id=? AND t.retired_at IS NULL ORDER BY t.name,t.id`).bind(workspaceId).all<{id:string;name:string;createdAt:string;createdBy:string|null}>()).results
  }
  async save(input: {workspaceId:string;operatorId:string;flowId:string;name:string;source:'draft'|'published';expectedVersion:number}) {
    const name=input.name.trim()
    if (!name || name.length>100) throw new ValidationError('Enter a template name of at most 100 characters.')
    const flow = await this.flows.findWorkspaceFlow(input.flowId,input.workspaceId)
    if (!flow) throw new NotFoundError('This flow does not exist.')
    const revision = input.source === 'draft' ? await this.flows.findRevision(flow.id,'draft') : await this.flows.findCurrentPublishedRevision(flow.id)
    if (!revision) throw new NotFoundError('This flow has no matching version to save.')
    const steps = await this.flows.getSteps(revision.id), choices = await this.flows.getChoices(steps.map(s => s.id)), rules = await this.flows.getBranchRules(revision.id)
    const id = ulid(), now = new Date().toISOString()
    const content = copyContent({steps,choices,rules,formSettings:formSettings(revision.formSettingsJson)},ulid(),now)
    if (content.formSettings?.linkPreview?.image) {
      if (!this.previewAssets) throw new ValidationError('Share image storage is not configured.')
      content.formSettings = await this.previewAssets.copyOwned(input.workspaceId, flow.id, id, content.formSettings)
    }
    const rows = await this.db.batch([this.db.prepare(`INSERT INTO team_templates (id,workspace_id,name,structure_json,created_by,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM flows WHERE id=? AND workspace_id=? AND draft_version=?) RETURNING id`).bind(id,input.workspaceId,name,JSON.stringify(content),input.operatorId,now,flow.id,input.workspaceId,input.expectedVersion),
      this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'template.saved',?,'team-template',id,?,? FROM team_templates WHERE id=?`).bind(ulid(),input.operatorId,JSON.stringify({templates:1,...this.attribution}),now,id),
    ])
    if (!rows[0].results.length) throw new ValidationError('The flow changed. Reload it before saving a template.')
    return {id,name}
  }
  async retire(workspaceId:string,id:string,operatorId:string|null=null) {
    const at=new Date().toISOString()
    const rows = await this.db.batch([this.db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'template.retired',?,'team-template',id,?,? FROM team_templates WHERE id=? AND workspace_id=? AND retired_at IS NULL`).bind(ulid(),operatorId,JSON.stringify({templates:1,...this.attribution}),at,id,workspaceId),
      this.db.prepare('UPDATE team_templates SET retired_at=? WHERE id=? AND workspace_id=? AND retired_at IS NULL RETURNING id').bind(at,id,workspaceId)])
    if (!rows[1].results.length) throw new NotFoundError('This template is not available.')
  }
  async create(input:{workspaceId:string;templateId:string;title:string;slug:string;operatorId?:string}) {
    const template = await this.db.prepare('SELECT structure_json AS content FROM team_templates WHERE id=? AND workspace_id=? AND retired_at IS NULL').bind(input.templateId,input.workspaceId).first<{content:string}>()
    if (!template) throw new NotFoundError('This template is not available.')
    const title=input.title.trim(), slug=input.slug.trim().toLowerCase()
    if (!title || title.length>200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>120) throw new ValidationError('Enter a flow name and a valid public link.')
    const id=ulid(), revisionId=ulid(), now=new Date().toISOString()
    const content=copyContent(JSON.parse(template.content) as Content,revisionId,now)
    if (content.formSettings?.linkPreview?.image) {
      if (!this.previewAssets) throw new ValidationError('Share image storage is not configured.')
      content.formSettings = await this.previewAssets.copyOwned(input.workspaceId, input.templateId, id, content.formSettings)
    }
    const created=await this.flows.createStructure({
      ...(input.operatorId ? {audit:{id:ulid(),operatorId:input.operatorId,feature:'team-template'}} : {}),
      flow:{id,workspaceId:input.workspaceId,title,slug,status:'draft',draftVersion:0,lastActivityAt:now,createdAt:now,updatedAt:now},
      revision:{formSettingsJson:JSON.stringify(content.formSettings),id:revisionId,flowId:id,number:1,state:'draft',title,publishedAt:null,isCurrent:false,createdAt:now,updatedAt:now},
      ...content,
    })
    if (!created) throw new ValidationError('That flow link is already in use.')
    return {id,title,slug}
  }
}
