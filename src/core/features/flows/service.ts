import { formSettings, hiddenSettingsIssue, hiddenPublicationIssues, normalizeHidden, hiddenAnswers, type FormSettings } from '../../shared/hiddenFields'
import { screenChanges } from './screen-authoring'
import type { ScreenLayout } from '../../shared/screenLayout'
import { visibilityCondition } from '../../shared/screenLayout'
import { evaluateCondition } from '../../shared/conditions'
import { remapLayoutSettings } from '../../shared/screenLayout'
import { answerIssue, isUnanswered } from '../../shared/answers'
import { remapCondition, type Condition } from '../../shared/conditions'
import { choiceLimit, structureLimitIssue } from '../../shared/formLimits'
import { remapAnswerRecall } from '../../shared/answerRecall'
import { remapChoiceSettings } from '../../shared/otherChoices'
import type { QuestionType } from '../../shared/questionKinds'
import { typeSettingsValid } from '../../shared/questionTypes'
import { templateStructure, type FlowTemplateId } from './templates'
import { structureContent } from './unpublished'
import { defaultFlowPolicies, evaluateFlowPolicies, revisionBranchSelection, type FlowPolicies } from '../../shared/flowPolicies'
import { publicSteps, publicChoices, publicRules } from './serialization'
import { ulid } from 'ulid'
import { FlowClosedError, NotFoundError, ValidationError } from '../../shared/errors'
import type { ResponseRepository } from '../responses'
import { resolveNextStep, validateRevisionGraph, type BranchPredicateKind } from './graph'
import type { FlowRepository, StoredBranchRule, StoredChoice, StoredStep } from './repository'


type StepKind = 'welcome' | 'question' | 'completion'
type DraftStepInput = {
  kind: StepKind
  questionType: QuestionType | null
  prompt: string
  helperText?: string | null
  required?: boolean
  nextStepId?: string | null
  questionSettings?: Record<string, unknown> | null
  choices?: Array<{ value: string; label: string }>
}
type BranchInput = {
  id?: string
  sourceStepId: string
  predicateKind: BranchPredicateKind
  expectedValue: unknown
  condition?: Condition | null
  destinationStepId: string
  position: number
}

function draftConflict(latestVersion: number) {
  return { kind: 'conflict' as const, latestVersion }
}

export class FlowService {
  constructor(
    private readonly repository: FlowRepository,
    private readonly responseRepository: ResponseRepository,
    private readonly policyConfiguration: FlowPolicies = defaultFlowPolicies,
  ) {}

  async ensureSampleFlow(input: {
    workspaceId: string
    flow: { id: string; slug: string; title: string; status: 'draft' | 'open' | 'closed' | 'archived'; draftVersion: number; lastActivityAt: string; createdAt: string; updatedAt: string }
    revisions: Array<{ id: string; number: number; state: 'draft' | 'published'; title: string; publishedAt: string | null; createdAt: string; updatedAt: string }>
    steps: Array<{ id: string; revisionId: string; position: number; kind: StepKind; questionType: QuestionType | null; prompt: string; helperText: string | null; required: boolean; createdAt: string; updatedAt: string }>
    choices: Array<{ id: string; stepId: string; value: string; label: string; position: number; createdAt: string; updatedAt: string }>
  }) {
    await this.repository.ensureFlow({ ...input.flow, workspaceId: input.workspaceId })
    for (const revision of input.revisions) {
      await this.repository.ensureRevision({
        ...revision,
        flowId: input.flow.id,
        isCurrent: revision.state === 'published',
        admissionClosedAt: null,
        admissionCloseReason: null,
        deadlineAt: null,
        deadlineTimeZone: null,
        targetCompletedResponses: null,
        policySnapshotJson: revision.state === 'published' ? JSON.stringify(evaluateFlowPolicies(this.policyConfiguration)) : null,
      })
    }
    const publishedSteps = input.steps.filter((step) => input.revisions.find((revision) => revision.id === step.revisionId)?.state === 'published')
    const stableByDraftPosition = new Map(publishedSteps.map((step) => [step.position, step.id]))
    for (const step of input.steps) {
      const stableId = input.revisions.find((revision) => revision.id === step.revisionId)?.state === 'draft'
        ? stableByDraftPosition.get(step.position) ?? step.id
        : step.id
      const later = input.steps.find((candidate) => candidate.revisionId === step.revisionId && candidate.position === step.position + 1)
      const laterStableId = later
        ? (input.revisions.find((revision) => revision.id === later.revisionId)?.state === 'draft' ? stableByDraftPosition.get(later.position) ?? later.id : later.id)
        : null
      await this.repository.ensureStep({ ...step, stableId, nextStepStableId: step.kind === 'completion' ? null : laterStableId, questionSettingsJson: null })
    }
    const draftChoices = input.choices.filter((choice) => input.revisions.find((revision) => revision.id === input.steps.find((step) => step.id === choice.stepId)?.revisionId)?.state === 'draft')
    const publishedChoices = input.choices.filter((choice) => !draftChoices.includes(choice))
    for (const choice of input.choices) {
      const isDraft = draftChoices.includes(choice)
      const equivalent = isDraft ? publishedChoices.find((published) => published.value === choice.value && input.steps.find((step) => step.id === published.stepId)?.position === input.steps.find((step) => step.id === choice.stepId)?.position) : undefined
      await this.repository.ensureChoice({ ...choice, stableId: equivalent?.id ?? choice.id })
    }
  }

  async listDashboard(workspaceId: string, status?: 'draft' | 'open' | 'closed' | 'archived') {
    const dashboardFlows = await this.repository.listDashboardFlows(workspaceId, status)
    return Promise.all(dashboardFlows.map(async (flow) => {
      const publishedRevision = await this.repository.findCurrentPublishedRevision(flow.id)
      const result = publishedRevision ? await this.responseRepository.getResults(publishedRevision.id) : undefined
      return {
        id: flow.id,
        slug: flow.slug,
        title: flow.title,
        status: flow.status,
        draftVersion: flow.draftVersion,
        hasUnpublishedChanges: await this.hasUnpublishedChanges(workspaceId, flow.id),
        lastActivityAt: flow.lastActivityAt,
        analysis: await this.repository.latestAnalysis(workspaceId, flow.id),
        completedResponses: result?.completedResponses ?? 0,
        starts: result?.counter?.starts ?? 0,
        audience: publishedRevision ? await this.responseRepository.audience(publishedRevision.id) : { launchedParticipants: 0, eligibleParticipants: 0, completedParticipants: 0 },
      }
    }))
  }

  async createDraftFlow(input: { workspaceId: string; title: string; slug: string; template?: FlowTemplateId }) {
    const title = input.title.trim()
    const slug = input.slug.trim().toLowerCase()
    if (!title || title.length > 200) throw new ValidationError('A flow title must be between 1 and 200 characters.')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ValidationError('A flow link must use lowercase letters, numbers, and single hyphens.')
    const now = new Date().toISOString()
    const flowId = ulid()
    const revisionId = ulid()
    const created = await this.repository.createStructure({
      flow: { id: flowId, workspaceId: input.workspaceId, title, slug, status: 'draft', draftVersion: 0, lastActivityAt: now, createdAt: now, updatedAt: now },
      revision: { id: revisionId, flowId, number: 1, state: 'draft', title, publishedAt: null, isCurrent: false, admissionClosedAt: null, admissionCloseReason: null, deadlineAt: null, deadlineTimeZone: null, targetCompletedResponses: null, policySnapshotJson: null, createdAt: now, updatedAt: now },
      ...(input.template ? templateStructure(input.template, revisionId, now) : {}),
    })
    if (!created) throw new ValidationError('That flow link is already in use.')
    return { id: flowId, slug, title }
  }

  async duplicateFlow(input: { operatorId?: string; workspaceId: string; flowId: string; title: string; slug: string }) {
    const sourceFlow = await this.requireWorkspaceFlow(input.workspaceId, input.flowId)
    const title = input.title.trim()
    const slug = input.slug.trim().toLowerCase()
    if (!title || title.length > 200) throw new ValidationError('A flow title must be between 1 and 200 characters.')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ValidationError('A flow link must use lowercase letters, numbers, and single hyphens.')
    if (await this.repository.findFlowBySlug(slug)) throw new ValidationError('That flow link is already in use.')
    const sourceRevision = await this.repository.findRevision(sourceFlow.id, 'draft') ?? await this.repository.findCurrentPublishedRevision(sourceFlow.id)
    if (!sourceRevision) throw new NotFoundError('The source flow has no structure to duplicate.')
    const sourceSteps = await this.repository.getSteps(sourceRevision.id)
    const sourceChoices = await this.repository.getChoices(sourceSteps.map((step) => step.id))
    const sourceRules = await this.repository.getBranchRules(sourceRevision.id)
    const now = new Date().toISOString()
    const flowId = ulid()
    const revisionId = ulid()
    const copiedSettings = formSettings(sourceRevision.formSettingsJson)
    const fieldIds = new Map(copiedSettings.hiddenFields.map(field => [field.id,ulid()]))
    const stableIdByOldStableId = new Map([...sourceSteps.map((step) => [step.stableId, ulid()] as [string,string]), ...[...fieldIds].map(([old,id]) => [`hidden:${old}`,`hidden:${id}`] as [string,string])])
    copiedSettings.hiddenFields = copiedSettings.hiddenFields.map(field => ({...field,id:fieldIds.get(field.id)!}))
    const rowIdByOldRowId = new Map(sourceSteps.map((step) => [step.id, ulid()]))
    const choiceStableIdByOldStableId = new Map(sourceChoices.map((choice) => [choice.stableId, ulid()]))
    const created = await this.repository.createStructure({
      flow: { id: flowId, workspaceId: input.workspaceId, title, slug, status: 'draft', draftVersion: 0, lastActivityAt: now, createdAt: now, updatedAt: now },
      revision: { formSettingsJson: JSON.stringify(copiedSettings), id: revisionId, flowId, number: 1, state: 'draft', title, publishedAt: null, isCurrent: false, admissionClosedAt: null, admissionCloseReason: null, deadlineAt: null, deadlineTimeZone: null, targetCompletedResponses: null, policySnapshotJson: null, createdAt: now, updatedAt: now },
      steps: sourceSteps.map((step) => ({ ...step, id: rowIdByOldRowId.get(step.id)!, revisionId, stableId: stableIdByOldStableId.get(step.stableId)!, prompt: remapAnswerRecall(step.prompt, stableIdByOldStableId), helperText: step.helperText === null ? null : remapAnswerRecall(step.helperText, stableIdByOldStableId), questionSettingsJson: remapLayoutSettings(remapChoiceSettings(step.questionSettingsJson, choiceStableIdByOldStableId), stableIdByOldStableId, choiceStableIdByOldStableId), nextStepStableId: step.nextStepStableId ? stableIdByOldStableId.get(step.nextStepStableId) ?? null : null, createdAt: now, updatedAt: now })),
      choices: sourceChoices.map((choice) => ({ ...choice, id: ulid(), stepId: rowIdByOldRowId.get(choice.stepId)!, stableId: choiceStableIdByOldStableId.get(choice.stableId)!, label: remapAnswerRecall(choice.label, stableIdByOldStableId), createdAt: now, updatedAt: now })),
      rules: sourceRules.map((rule) => {
        const expected = JSON.parse(rule.expectedValueJson) as unknown
        const remappedExpected = typeof expected === 'string' ? choiceStableIdByOldStableId.get(expected) ?? expected
          : Array.isArray(expected) ? expected.map((value) => typeof value === 'string' ? choiceStableIdByOldStableId.get(value) ?? value : value)
          : expected && typeof expected === 'object' && 'choiceId' in expected ? { ...expected, choiceId: choiceStableIdByOldStableId.get(String(expected.choiceId)) ?? expected.choiceId } : expected
        return { ...rule, id: ulid(), revisionId, sourceStepStableId: stableIdByOldStableId.get(rule.sourceStepStableId)!, destinationStepStableId: stableIdByOldStableId.get(rule.destinationStepStableId)!, expectedValueJson: JSON.stringify(remappedExpected), conditionJson: rule.conditionJson ? JSON.stringify(remapCondition(JSON.parse(rule.conditionJson), stableIdByOldStableId, choiceStableIdByOldStableId)) : null, createdAt: now, updatedAt: now }
      }),
    })
    if (!created) throw new ValidationError('That flow link is already in use.')
    return { id: flowId, title, slug }
  }

  async getFlowWorkspaceId(slug: string) {
    return (await this.repository.findFlowBySlug(slug))?.workspaceId
  }

  private async requireDraftSnapshot(workspaceId: string, flowId: string) {
    const { flow, revision, steps, choices, rules } = await this.repository.getWorkspaceDraftSnapshot(workspaceId, flowId)
    if (!flow) throw new NotFoundError('The requested flow does not exist in this workspace.')
    if (!revision) throw new NotFoundError('The requested flow has no editable draft.')
    return { flow, revision, steps, choices, rules }
  }

  private builderDraft({ flow, revision, steps, choices, rules }: Awaited<ReturnType<FlowService['requireDraftSnapshot']>>) {
    return { formSettings: formSettings(revision.formSettingsJson), branchSelection: evaluateFlowPolicies(this.policyConfiguration)['flow.branch-selection.v1'], flow, revision: this.publicRevision(revision), steps: publicSteps(steps), choices: publicChoices(steps, choices), branchRules: publicRules(rules) }
  }

  private async hasUnpublishedChanges(workspaceId: string, flowId: string) {
    const published = await this.repository.findCurrentPublishedRevision(flowId)
    if (!published) return false
    const [draft, steps, rules] = await Promise.all([
      this.requireDraftSnapshot(workspaceId, flowId),
      this.repository.getSteps(published.id),
      this.repository.getBranchRules(published.id),
    ])
    const choices = await this.repository.getChoices(steps.map(step => step.id))
    return draft.revision.formSettingsJson !== published.formSettingsJson || structureContent(draft.steps, draft.choices, draft.rules) !== structureContent(steps, choices, rules)
  }

  async getBuilderDraft(workspaceId: string, flowId: string) {
    const draft = this.builderDraft(await this.requireDraftSnapshot(workspaceId, flowId))
    return { ...draft, flow: { ...draft.flow, hasUnpublishedChanges: await this.hasUnpublishedChanges(workspaceId, flowId) } }
  }

  async updateFormSettings(input: {operatorId?:string;workspaceId:string;flowId:string;expectedVersion:number;settings:FormSettings}) {
    const {flow,revision} = await this.requireDraftSnapshot(input.workspaceId,input.flowId)
    if (flow.draftVersion !== input.expectedVersion) return draftConflict(flow.draftVersion)
    if (flow.status === 'archived') throw new ValidationError('Duplicate an archived flow before editing.')
    const issue = hiddenSettingsIssue(input.settings)
    if (issue) throw new ValidationError(issue)
    if (!await this.repository.updateFormSettings({...input,revisionId:revision.id,json:JSON.stringify(input.settings),now:new Date().toISOString()})) return draftConflict((await this.requireWorkspaceFlow(input.workspaceId,input.flowId)).draftVersion)
    return {kind:'updated' as const,draftVersion:input.expectedVersion+1}
  }

  async getFlowResults(workspaceId: string, flowId: string, revisionId?: string) {
    const flow = await this.requireWorkspaceFlow(workspaceId, flowId)
    const revision = revisionId ? await this.repository.findRevisionById(revisionId) : await this.repository.findCurrentPublishedRevision(flow.id)
    if (!revision || revision.flowId !== flow.id || revision.state !== 'published') throw new NotFoundError('This flow has no matching published revision.')
    const { counter, completedResponses, liveCompletedResponses, importedResponses } = await this.responseRepository.getResults(revision.id)
    const metrics = counter ?? {
      starts: 0,
      completions: 0,
      totalCompletionMilliseconds: 0,
      mobileStarts: 0,
      tabletStarts: 0,
      desktopStarts: 0,
    }
    return {
      flow: { id: flow.id, title: flow.title, slug: flow.slug, status: flow.status },
      revision: this.publicRevision(revision),
      starts: metrics.starts,
      completedResponses,
      liveCompletedResponses,
      importedResponses,
      completionRate: metrics.starts === 0 ? 0 : liveCompletedResponses / metrics.starts,
      averageCompletionMilliseconds: liveCompletedResponses === 0 ? 0 : Math.round(metrics.totalCompletionMilliseconds / liveCompletedResponses),
      deviceStarts: { mobile: metrics.mobileStarts, tablet: metrics.tabletStarts, desktop: metrics.desktopStarts },
    }
  }

  async updateBuilderDraft(input: { operatorId?: string; workspaceId: string; flowId: string; stepId: string; prompt: string; required: boolean; expectedVersion: number; helperText?: string | null; nextStepId?: string | null; questionSettings?: Record<string, unknown> | null; questionType?: QuestionType | null; choices?: Array<{ id?: string; newId?: string; value: string; label: string }>; rules?: BranchInput[] }) {
    if (!input.prompt.trim() || input.prompt.length > 1000) throw new ValidationError('A step prompt must be between 1 and 1000 characters.')
    const snapshot = await this.requireDraftSnapshot(input.workspaceId, input.flowId)
    const draft = this.builderDraft(snapshot)
    if (input.expectedVersion !== draft.flow.draftVersion) return draftConflict(draft.flow.draftVersion)
    const selected = draft.steps.find((step) => step.id === input.stepId)
    if (!selected) throw new NotFoundError('The requested draft step does not exist.')
    if (selected.kind !== 'question' && (input.questionType !== undefined || input.choices !== undefined)) throw new ValidationError('Only questions can have a question type or choices.')
    const selectedQuestionType = input.questionType === undefined ? selected.questionType : input.questionType
    if (selected.kind === 'question' && !selectedQuestionType) throw new ValidationError('A question needs a question type.')
    if (draft.flow.status === 'archived') throw new ValidationError('An archived flow cannot be published or reopened. Duplicate it to create a separate draft.')
    const { steps: rawSteps, choices: rawChoices } = snapshot
    const selectedRawStep = rawSteps.find((step) => step.stableId === input.stepId)
    if (!selectedRawStep) throw new NotFoundError('The requested draft step does not exist.')
    const currentChoices = rawChoices.filter((choice) => choice.stepId === selectedRawStep.id)
    if (!typeSettingsValid(selectedQuestionType, input.questionSettings === undefined ? selected.questionSettings ?? {} : input.questionSettings ?? {})) throw new ValidationError('This question has invalid type-specific settings.')
    const structured = ['single_choice', 'multiple_choice', 'priority', 'dropdown'].includes(selectedQuestionType ?? '')
    if (input.choices !== undefined && !structured && input.choices.length > 0) throw new ValidationError('Only structured questions can have choices.')
    const requestedChoices = input.choices ?? currentChoices.map((choice) => ({ id: choice.stableId, value: choice.value, label: choice.label }))
    if (input.choices !== undefined && input.choices.some((choice) => !choice.value.trim() || !choice.label.trim())) throw new ValidationError('Every choice needs a value and label.')
    if (requestedChoices.length > choiceLimit(selectedQuestionType)) throw new ValidationError('This question exceeds its configured choice limit.')
    const choicesByStableId = new Map(currentChoices.map((choice) => [choice.stableId, choice]))
    const now = new Date().toISOString()
    const persistedChoices = structured ? requestedChoices.map((choice, position) => {
      const existing = choice.id ? choicesByStableId.get(choice.id) : undefined
      if (choice.id && !existing) throw new ValidationError('A choice edit must refer to a choice on this question.')
      if ('newId' in choice && choice.newId && rawChoices.some(existingChoice => existingChoice.stableId === choice.newId)) throw new ValidationError('A new choice must have a unique identifier.')
      return { id: existing?.id ?? ulid(), stableId: existing?.stableId ?? ('newId' in choice ? choice.newId : undefined) ?? ulid(), value: choice.value.trim(), label: choice.label.trim(), position, createdAt: existing?.createdAt ?? now, updatedAt: now }
    }) : []
    if (new Set(persistedChoices.map((choice) => choice.label.toLocaleLowerCase())).size !== persistedChoices.length) throw new ValidationError('Each choice needs a different label.')
    if (new Set(persistedChoices.map((choice) => choice.value)).size !== persistedChoices.length) throw new ValidationError('Each choice needs a different answer value.')
    if (new Set(persistedChoices.map(choice => choice.stableId)).size !== persistedChoices.length) throw new ValidationError('Choices must be distinct.')
    const rules = input.rules?.map(rule => ({ id: rule.id ?? ulid(), revisionId: draft.revision.id, sourceStepStableId: rule.sourceStepId, predicateKind: rule.predicateKind, expectedValueJson: JSON.stringify(rule.expectedValue), conditionJson: rule.condition ? JSON.stringify(rule.condition) : null, destinationStepStableId: rule.destinationStepId, position: rule.position, createdAt: now, updatedAt: now }))
    if (rules) {
      const nextSteps = rawSteps.map(step => step.stableId === input.stepId ? { ...step, questionType: selectedQuestionType, nextStepStableId: input.nextStepId === undefined ? step.nextStepStableId : input.nextStepId } : step)
      const nextChoices = [...rawChoices.filter(choice => choice.stepId !== selectedRawStep.id), ...persistedChoices.map(choice => ({ ...choice, stepId: selectedRawStep.id }))]
      const issues = validateRevisionGraph(nextSteps, nextChoices, rules, evaluateFlowPolicies(this.policyConfiguration)['flow.branch-selection.v1'],formSettings(snapshot.revision.formSettingsJson)).filter(issue => issue.reason.toLowerCase().includes('branch') || issue.reason.toLowerCase().includes('predicate'))
      if (issues.length) throw new ValidationError('Answer paths are invalid.', issues)
    }
    const updated = await this.repository.updateDraftStep({ operatorId: input.operatorId,
      flowId: input.flowId, revisionId: draft.revision.id, expectedVersion: input.expectedVersion, now,
      stepStableId: input.stepId, questionType: selected.kind === 'question' ? selectedQuestionType : null, prompt: input.prompt.trim(), required: selected.kind === 'question' ? input.required : false,
      helperText: input.helperText === undefined ? selected.helperText : input.helperText,
      nextStepStableId: input.nextStepId === undefined ? selected.nextStepId : input.nextStepId,
      questionSettingsJson: input.questionSettings === undefined ? (selected.questionSettings ? JSON.stringify(selected.questionSettings) : null) : (input.questionSettings ? JSON.stringify(input.questionSettings) : null),
      choices: persistedChoices, rules,
    })
    if (!updated) return draftConflict((await this.requireWorkspaceFlow(input.workspaceId, input.flowId)).draftVersion)
    return { kind: 'updated' as const, draftVersion: input.expectedVersion + 1, step: publicSteps([updated])[0] }
  }

  async updateScreen(input:{operatorId?:string;workspaceId:string;flowId:string;stepId:string;expectedVersion:number;layout:ScreenLayout|null}) {
    const snapshot=await this.requireDraftSnapshot(input.workspaceId,input.flowId)
    if(snapshot.flow.draftVersion!==input.expectedVersion) return draftConflict(snapshot.flow.draftVersion)
    if(snapshot.flow.status==='archived') throw new ValidationError('Duplicate an archived flow before editing.')
    const changes=screenChanges(this.builderDraft(snapshot),input.stepId,input.layout)
    const saved=await this.repository.updateScreen({...input,revisionId:snapshot.revision.id,now:new Date().toISOString(),changes})
    return saved?{kind:'updated' as const,draftVersion:input.expectedVersion+1}:draftConflict((await this.requireWorkspaceFlow(input.workspaceId,input.flowId)).draftVersion)
  }

  async addDraftStep(input: { operatorId?: string; workspaceId: string; flowId: string; expectedVersion: number; step: DraftStepInput }) {
    const draft = await this.getBuilderDraft(input.workspaceId, input.flowId)
    if (input.expectedVersion !== draft.flow.draftVersion) return draftConflict(draft.flow.draftVersion)
    if (draft.flow.status === 'archived') throw new ValidationError('Duplicate an archived flow to create an editable draft.')
    if (input.step.kind === 'welcome' && draft.steps.some((step) => step.kind === 'welcome')) throw new ValidationError('A flow may contain only one welcome screen.')
    const capacityIssue = structureLimitIssue([...draft.steps, input.step])
    if (capacityIssue) throw new ValidationError(capacityIssue)
    if ((input.step.choices?.length ?? 0) > choiceLimit(input.step.questionType)) throw new ValidationError('This question exceeds its configured choice limit.')
    const completionIndex = draft.steps.findIndex((step) => step.kind === 'completion')
    const position = input.step.kind === 'welcome' ? 0 : input.step.kind === 'question' && completionIndex >= 0 ? completionIndex : draft.steps.length
    const following = draft.steps[position]
    const previous = draft.steps[position - 1]
    const nextId = input.step.nextStepId ?? (input.step.kind === 'completion' ? null : following?.id ?? null)
    // Complete an unfinished sequence, but preserve every existing answer path.
    // Inserting before a completion never opts earlier questions into this one.
    const connectPrevious = !following && previous && previous.kind !== 'completion' && previous.nextStepId === null ? previous.id : undefined
    const now = new Date().toISOString()
    const stableId = ulid()
    const stepId = ulid()
    if (input.step.kind === 'question' && !input.step.questionType) throw new ValidationError('A question needs a question type.')
    if (input.step.kind !== 'question' && input.step.questionType) throw new ValidationError('Only questions can have a question type.')
    if (!typeSettingsValid(input.step.questionType, input.step.questionSettings ?? {})) throw new ValidationError('This question has invalid type-specific settings.')
    const choiceIdMap = new Map<string, string>()
    const choices = (input.step.choices ?? []).map((choice, position) => { const stableId = ulid(); if ('id' in choice && typeof choice.id === 'string') choiceIdMap.set(choice.id, stableId); return { id: ulid(), stepId, stableId, value: choice.value.trim(), label: choice.label.trim(), position, createdAt: now, updatedAt: now } })
    if (choices.some((choice) => !choice.value || !choice.label)) throw new ValidationError('Every choice needs a value and label.')
    const created = await this.repository.createDraftStep({ operatorId: input.operatorId,
      flowId: input.flowId, revisionId: draft.revision.id, expectedVersion: input.expectedVersion, now, connectPrevious,
      step: {
        id: stepId, revisionId: draft.revision.id, position, stableId, kind: input.step.kind,
        questionType: input.step.questionType, prompt: input.step.prompt.trim(), helperText: input.step.helperText ?? null,
        required: input.step.kind === 'question' && Boolean(input.step.required), nextStepStableId: nextId,
        questionSettingsJson: remapChoiceSettings(input.step.questionSettings ? JSON.stringify(input.step.questionSettings) : null, choiceIdMap), createdAt: now, updatedAt: now,
      },
      choices,
    })
    if (!created) return draftConflict((await this.requireWorkspaceFlow(input.workspaceId, input.flowId)).draftVersion)
    return { kind: 'created' as const, draftVersion: input.expectedVersion + 1, step: publicSteps([created])[0] }
  }

  async duplicateDraftStep(input: { operatorId?: string; workspaceId: string; flowId: string; expectedVersion: number; stepId: string }) {
    const draft = await this.getBuilderDraft(input.workspaceId, input.flowId)
    if (input.expectedVersion !== draft.flow.draftVersion) return draftConflict(draft.flow.draftVersion)
    const source = draft.steps.find((step) => step.id === input.stepId)
    if (!source) throw new NotFoundError('The requested draft step does not exist.')
    return this.addDraftStep({
      workspaceId: input.workspaceId,
      flowId: input.flowId,
      expectedVersion: input.expectedVersion,
      step: { ...source, kind: source.kind, questionType: source.questionType, choices: draft.choices.filter((choice) => choice.stepId === source.id).map((choice) => ({ id: choice.id, value: choice.value, label: choice.label })) },
    })
  }

  async deleteDraftStep(input: { operatorId?: string; workspaceId: string; flowId: string; expectedVersion: number; stepId: string }) {
    const draft = await this.getBuilderDraft(input.workspaceId, input.flowId)
    if (input.expectedVersion !== draft.flow.draftVersion) return draftConflict(draft.flow.draftVersion)
    const now = new Date().toISOString()
    const deleted = await this.repository.deleteDraftStep({ operatorId: input.operatorId, flowId: input.flowId, revisionId: draft.revision.id, expectedVersion: input.expectedVersion, now, stepStableId: input.stepId })
    if (!deleted) return draftConflict((await this.requireWorkspaceFlow(input.workspaceId, input.flowId)).draftVersion)
    return { kind: 'deleted' as const, draftVersion: input.expectedVersion + 1 }
  }

  async reorderDraftSteps(input: { operatorId?: string; workspaceId: string; flowId: string; expectedVersion: number; orderedStepIds: string[] }) {
    const draft = await this.getBuilderDraft(input.workspaceId, input.flowId)
    if (input.expectedVersion !== draft.flow.draftVersion) return draftConflict(draft.flow.draftVersion)
    if (new Set(input.orderedStepIds).size !== draft.steps.length || input.orderedStepIds.length !== draft.steps.length || input.orderedStepIds.some((id) => !draft.steps.some((step) => step.id === id))) throw new ValidationError('Reordering must include every current draft step exactly once.')
    const welcome = draft.steps.find((step) => step.kind === 'welcome')
    if (welcome && input.orderedStepIds[0] !== welcome.id) throw new ValidationError('A welcome screen can only be first.')
    const reordered = await this.repository.reorderDraftSteps({ operatorId: input.operatorId, flowId: input.flowId, revisionId: draft.revision.id, expectedVersion: input.expectedVersion, now: new Date().toISOString(), orderedStableIds: input.orderedStepIds })
    if (!reordered) return draftConflict((await this.requireWorkspaceFlow(input.workspaceId, input.flowId)).draftVersion)
    return { kind: 'reordered' as const, draftVersion: input.expectedVersion + 1 }
  }

  async replaceDraftBranchRules(input: { operatorId?: string; workspaceId: string; flowId: string; expectedVersion: number; rules: BranchInput[] }) {
    const snapshot = await this.requireDraftSnapshot(input.workspaceId, input.flowId)
    const draft = this.builderDraft(snapshot)
    if (input.expectedVersion !== draft.flow.draftVersion) return draftConflict(draft.flow.draftVersion)
    const now = new Date().toISOString()
    const rules = input.rules.map((rule) => ({ id: rule.id ?? ulid(), revisionId: draft.revision.id, sourceStepStableId: rule.sourceStepId, predicateKind: rule.predicateKind, expectedValueJson: JSON.stringify(rule.expectedValue), conditionJson: rule.condition ? JSON.stringify(rule.condition) : null, destinationStepStableId: rule.destinationStepId, position: rule.position, createdAt: now, updatedAt: now }))
    if (draft.flow.status === 'archived') throw new ValidationError('An archived flow cannot be published or reopened. Duplicate it to create a separate draft.')
    const { steps: rawSteps, choices: rawChoices } = snapshot
    const graphIssues = validateRevisionGraph(rawSteps, rawChoices, rules, evaluateFlowPolicies(this.policyConfiguration)['flow.branch-selection.v1'],formSettings(snapshot.revision.formSettingsJson))
      .filter((issue) => issue.reason.toLowerCase().includes('branch') || issue.reason.toLowerCase().includes('predicate'))
    if (graphIssues.length > 0) throw new ValidationError('Branch rules are invalid.', graphIssues)
    const replaced = await this.repository.replaceDraftBranchRules({ operatorId: input.operatorId, flowId: input.flowId, revisionId: draft.revision.id, expectedVersion: input.expectedVersion, now, rules })
    if (!replaced) return draftConflict((await this.requireWorkspaceFlow(input.workspaceId, input.flowId)).draftVersion)
    return { kind: 'updated' as const, draftVersion: input.expectedVersion + 1 }
  }

  async previewDraft(input: { operatorId?: string; workspaceId: string; flowId: string; answers: Record<string, unknown>; hidden?:Record<string,unknown> }) {
    const { flow, revision, steps, choices, rules } = await this.repository.getWorkspaceDraftSnapshot(input.workspaceId, input.flowId)
    if (!flow || !revision) throw new NotFoundError('The requested flow has no editable draft.')
    const receipt = { preview: true as const, draftVersion: flow.draftVersion }
    const byStableId = new Map(steps.map((step) => [step.stableId, step]))
    const first = steps[0]
    if (!first) return { ...receipt, screens: [], complete: false, reason: 'The draft has no first screen.' }
    const screens: Array<{ stepId: string; evaluations: ReturnType<typeof resolveNextStep>['evaluations']; selectedRuleId: string | null; nextStepId: string | null }> = []
    const seen = new Set<string>()
    const accepted: Record<string, unknown> = hiddenAnswers(normalizeHidden(formSettings(revision.formSettingsJson),input.hidden ?? {}))
    let current: StoredStep | undefined = first
    while (current && !seen.has(current.stableId) && screens.length <= steps.length) {
      const step: StoredStep = current
      seen.add(step.stableId)
      const condition = visibilityCondition(publicSteps([step])[0])
      const visible = !condition || evaluateCondition(condition,accepted).matched
      const answer = input.answers[step.stableId]
      if (visible && step.kind === 'question' && !isUnanswered(answer) && !answerIssue(publicSteps([step])[0], choices.filter(choice => choice.stepId === step.id).map(choice => choice.stableId), answer)) accepted[step.stableId] = answer
      const selection = resolveNextStep({ selection: evaluateFlowPolicies(this.policyConfiguration)['flow.branch-selection.v1'], step, rules: rules.filter((rule) => rule.sourceStepStableId === step.stableId), answers: accepted })
      screens.push({ stepId: step.stableId, evaluations: selection.evaluations, selectedRuleId: selection.selectedRuleId, nextStepId: selection.nextStepId })
      if (step.kind === 'completion') return { ...receipt, screens, complete: true }
      current = selection.nextStepId ? byStableId.get(selection.nextStepId) : undefined
    }
    return { ...receipt, screens, complete: false, reason: current ? 'The draft branch graph cycles.' : 'The selected path does not reach a completion screen.' }
  }

  async publishDraft(input: { operatorId?: string; workspaceId: string; flowId: string; expectedVersion: number; deadlineAt?: string | null; targetCompletedResponses?: number | null }) {
    const snapshot = await this.requireDraftSnapshot(input.workspaceId, input.flowId)
    const draft = this.builderDraft(snapshot)
    if (input.expectedVersion !== draft.flow.draftVersion) return draftConflict(draft.flow.draftVersion)
    if (draft.flow.status === 'archived') throw new ValidationError('An archived flow cannot be published or reopened. Duplicate it to create a separate draft.')
    const { steps: rawSteps, choices: rawChoices, rules: rawRules } = snapshot
    const issues = validateRevisionGraph(rawSteps, rawChoices, rawRules, evaluateFlowPolicies(this.policyConfiguration)['flow.branch-selection.v1'], formSettings(snapshot.revision.formSettingsJson))
    issues.push(...hiddenPublicationIssues(formSettings(snapshot.revision.formSettingsJson)))
    if (issues.length > 0) throw new ValidationError('This draft cannot be published until every listed issue is resolved.', issues)
    if (input.targetCompletedResponses !== undefined && input.targetCompletedResponses !== null && (!Number.isInteger(input.targetCompletedResponses) || input.targetCompletedResponses <= 0)) throw new ValidationError('A completion target must be a positive whole number.')
    if (input.deadlineAt && Number.isNaN(Date.parse(input.deadlineAt))) throw new ValidationError('A revision deadline must be an ISO timestamp.')
    const now = new Date().toISOString()
    const nextDraftId = ulid()
    const newStepIdByOldId = new Map(rawSteps.map((step) => [step.id, ulid()]))
    const newDraft = { formSettingsJson: snapshot.revision.formSettingsJson, id: nextDraftId, flowId: input.flowId, number: draft.revision.number + 1, state: 'draft' as const, title: draft.flow.title, publishedAt: null, isCurrent: false, admissionClosedAt: null, admissionCloseReason: null, deadlineAt: null, deadlineTimeZone: null, targetCompletedResponses: null, policySnapshotJson: null, createdAt: now, updatedAt: now }
    const timeZone = await this.repository.getWorkspaceTimeZone(input.workspaceId)
    const published = await this.repository.publishDraft({ operatorId: input.operatorId,
      flowId: input.flowId, revisionId: draft.revision.id, expectedVersion: input.expectedVersion, now, currentRevisionId: draft.revision.id,
      newDraft,
      newSteps: rawSteps.map((step) => ({ ...step, id: newStepIdByOldId.get(step.id)!, revisionId: nextDraftId, createdAt: now, updatedAt: now })),
      newChoices: rawChoices.map((choice) => ({ ...choice, id: ulid(), stepId: newStepIdByOldId.get(choice.stepId)!, createdAt: now, updatedAt: now })),
      newRules: rawRules.map((rule) => ({ ...rule, id: ulid(), revisionId: nextDraftId, createdAt: now, updatedAt: now })),
      policySnapshotJson: JSON.stringify(evaluateFlowPolicies({...this.policyConfiguration,'response.identity.v1':draft.formSettings.identityMode==='identified'?'identified-public-link':'anonymous-public-link'})), deadlineAt: input.deadlineAt ?? null, deadlineTimeZone: input.deadlineAt ? timeZone ?? 'UTC' : null, targetCompletedResponses: input.targetCompletedResponses ?? null,
    })
    if (!published) return draftConflict((await this.requireWorkspaceFlow(input.workspaceId, input.flowId)).draftVersion)
    return { kind: 'published' as const, revision: { id: draft.revision.id, number: draft.revision.number }, draftVersion: input.expectedVersion + 1 }
  }

  async closeFlow(workspaceId: string, flowId: string, operatorId?: string) {
    const flow = await this.requireWorkspaceFlow(workspaceId, flowId)
    if (!['open', 'closed'].includes(flow.status)) throw new ValidationError('Only a published flow can be closed.')
    await this.repository.closeFlow(flowId, new Date().toISOString(), operatorId)
  }

  async reopenFlow(workspaceId: string, flowId: string, operatorId: string) {
    const flow = await this.requireWorkspaceFlow(workspaceId, flowId)
    if (flow.status !== 'closed') throw new ValidationError('Only a closed flow can be reopened.')
    const revision = await this.repository.findCurrentPublishedRevision(flowId)
    if (!revision) throw new NotFoundError('This flow has no published revision to reopen.')
    const results = await this.responseRepository.getResults(revision.id)
    if ((revision.deadlineAt && Date.parse(revision.deadlineAt) <= Date.now()) || (revision.targetCompletedResponses !== null && results.completedResponses >= revision.targetCompletedResponses)) throw new ValidationError('This revision cannot reopen while its deadline or completion target is still satisfied.')
    if (!await this.repository.reopenFlow(flowId, new Date().toISOString(), operatorId)) throw new ValidationError('This revision cannot reopen while its deadline or completion target is still satisfied.')
  }

  async archiveFlow(workspaceId: string, flowId: string, operatorId?: string) {
    const flow = await this.requireWorkspaceFlow(workspaceId, flowId)
    if (flow.status === 'archived') throw new ValidationError('An archived flow cannot reopen.')
    await this.repository.archiveFlow(flowId, new Date().toISOString(), operatorId)
  }

  async getPublicFlow(slug: string) {
    const resolved = await this.repository.getCurrentPublicSnapshot(slug)
    const flow = resolved?.flow
    if (!flow || flow.status === 'draft' || flow.status === 'archived') throw new NotFoundError('This flow is not available for responses.')
    const revision = resolved?.revision
    if (!revision) throw new NotFoundError('This flow has no published revision.')
    const expired = revision.deadlineAt && Date.parse(revision.deadlineAt) <= Date.now()
    if (expired) await this.repository.closeExpiredRevision(revision.id, new Date().toISOString())
    if (flow.status === 'closed' || revision.admissionClosedAt || expired || (revision.targetCompletedResponses !== null && resolved.completedResponses >= revision.targetCompletedResponses)) throw new FlowClosedError({ title: revision.title, slug: flow.slug })
    const { steps, choices, rules } = resolved
    return { formSettings: formSettings(revision.formSettingsJson), branchSelection: revisionBranchSelection(revision.policySnapshotJson), flow: { id: flow.id, slug: flow.slug, title: flow.title }, revision: this.publicRevision(revision), steps: publicSteps(steps), choices: publicChoices(steps, choices), branchRules: publicRules(rules) }
  }

  private async requireWorkspaceFlow(workspaceId: string, flowId: string) {
    const flow = await this.repository.findWorkspaceFlow(flowId, workspaceId)
    if (!flow) throw new NotFoundError('The requested flow does not exist.')
    return flow
  }

  private publicRevision(revision: { id: string; number: number; publishedAt: string | null; deadlineAt: string | null; targetCompletedResponses: number | null }) {
    return { id: revision.id, number: revision.number, publishedAt: revision.publishedAt, deadlineAt: revision.deadlineAt, targetCompletedResponses: revision.targetCompletedResponses }
  }
}
