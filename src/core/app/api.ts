import type { Condition, ConditionTrace } from '../shared/conditions'
import type { QuestionType } from '../shared/questionKinds'
import type { PaymentState } from '../shared/payments'
export type TeamTemplate = {id:string;name:string;createdAt:string;createdBy:string|null}
export type FlowStep = {
  id: string
  position: number
  kind: 'welcome' | 'question' | 'payment' | 'completion'
  questionType: QuestionType | null
  prompt: string
  helperText: string | null
  required: boolean
  nextStepId: string | null
  questionSettings: Record<string, unknown> | null
}

export type ChoiceOption = { id: string; stepId: string; value: string; label: string; position: number }

export type BranchRule = {
  id: string
  sourceStepId: string
  predicateKind: 'equals' | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'any_of' | 'all_of'
  expectedValue: unknown
  condition?: Condition | null
  destinationStepId: string
  position: number
}

export type PublicFlow = {
  prefillProof?: string
  prefilledAnswers?: Record<string,import('../shared/knownDataPrefill').PrefilledAnswer>
  reviewBeforeSubmit?: boolean
  presentation?: import('../shared/presentationOrder').PresentationOrder
  formSettings?: import('../shared/hiddenFields').FormSettings
  hiddenContext?: import('../shared/hiddenFields').ResponseContext
  branchSelection?: import('../shared/flowPolicies').BranchSelection
  identity?: 'anonymous' | 'identified'
  completedStepId?: string | null
  flow: { id: string; slug: string; title: string }
  revision: { id: string; number: number; publishedAt: string | null; deadlineAt: string | null; targetCompletedResponses: number | null }
  steps: FlowStep[]
  choices: ChoiceOption[]
  branchRules: BranchRule[]
}

export type SavedResponseState =
  | { state: 'open'; loadTime: string; flow: PublicFlow; sessionId: string; sessionToken: string; revisionId: string; answers: Array<{ stepId: string; value: unknown }>; currentStepId: string; invitationToken?: string; idempotencyKey?: string }
  | { state: 'completed'; flow: PublicFlow; completionStepId: string }
  | { state: 'unavailable'; startAgain: string; message: string }

/** PAY-001: where Stripe Checkout's success or cancel link leaves the respondent. */
export type PaymentReturnView =
  | (Extract<SavedResponseState, { state: 'open' }> & { payment: { state: PaymentState } })
  | { state: 'completed'; payment: { state: PaymentState }; flow: PublicFlow; answers: Array<{ stepId: string; value: unknown }>; completionStepId: string; redirectUrl: string | null }

export type DashboardFlow = {
  id: string
  slug: string
  title: string
  status: 'draft' | 'open' | 'closed' | 'archived'
  draftVersion: number
  lastActivityAt: string
  completedResponses: number
  starts: number
  analysis: { id:string; state:import('../features/analysis/model').RunState; revisionId:string; revisionNumber:number; evidenceCutoff:string; redacted:number; stale:number } | null
  audience: { launchedParticipants: number; eligibleParticipants: number; completedParticipants?: number }
}

export type BuilderDraft = PublicFlow & {
  flow: PublicFlow['flow'] & { status: DashboardFlow['status']; draftVersion: number }
}

export type TrafficReport = {rows:Array<import('../features/traffic').TrafficRow>;totals:{views:number;starts:number;submissions:number};startedAt:string|null;timeZone:string}
export type FlowResults = {
  flow: { id: string; title: string; slug: string; status: DashboardFlow['status'] }
  revision: PublicFlow['revision']
  starts: number
  completedResponses: number
  liveCompletedResponses: number
  importedResponses: number
  completionRate: number
  averageCompletionMilliseconds: number
  deviceStarts: { mobile: number; tablet: number; desktop: number }
}

export type WorkspaceSettings = {
  brandConfigured?: boolean
  id: string
  name: string
  timeZone: string
  sendingWindowStart: string
  sendingWindowEnd: string
  reminderDelayHours: number
  embedAllowedOrigins: string[]
}

export type Operator = {
  id: string
  email: string
  displayName: string
  isSetupOperator: boolean
  createdAt: string
}

export type ClosedFlow = { title: string; slug: string; collectionClosed?: boolean }

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly details?: Array<{ stepId: string; reason: string }>, readonly closedFlow?: ClosedFlow) {
    super(message)
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const body = await response.json().catch(() => ({})) as { error?: string; message?: string; details?: Array<{ stepId: string; reason: string }>; closedFlow?: ClosedFlow } & T
  if (!response.ok) {
    throw new ApiError(body.error ?? 'REQUEST_FAILED', body.message ?? 'The request could not be completed.', response.status, body.details, body.closedFlow)
  }
  return body
}

export const api = {
  dashboard: (status?: DashboardFlow['status']) => request<DashboardFlow[]>(`/api/app/dashboard${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  traffic: (flowId:string,revisionId:string,from?:string,to?:string) => request<TrafficReport>(`/api/app/flows/${encodeURIComponent(flowId)}/traffic?${new URLSearchParams({revisionId,...(from?{from}:{}),...(to?{to}:{})})}`),
  teamTemplates: () => request<TeamTemplate[]>('/api/app/templates'),
  saveTeamTemplate: (flowId:string,input:{name:string;source:'draft'|'published';expectedVersion:number}) => request<{id:string;name:string}>(`/api/app/flows/${encodeURIComponent(flowId)}/templates`,{method:'POST',body:JSON.stringify(input)}),
  retireTeamTemplate: (id:string) => request<void>(`/api/app/templates/${encodeURIComponent(id)}`,{method:'DELETE'}),
  createFromTeamTemplate: (id:string,input:{title:string;slug:string}) => request<{id:string;title:string;slug:string}>(`/api/app/templates/${encodeURIComponent(id)}/flows`,{method:'POST',body:JSON.stringify(input)}),
  createFlow: (input: { title: string; slug: string }) => request<{ id: string; slug: string; title: string }>('/api/app/flows', { method: 'POST', body: JSON.stringify(input) }),
  duplicateFlow: (flowId: string, input: { title: string; slug: string }) => request<{ id: string; slug: string; title: string }>(`/api/app/flows/${encodeURIComponent(flowId)}/duplicate`, { method: 'POST', body: JSON.stringify(input) }),
  builder: (flowId: string) => request<BuilderDraft>(`/api/app/flows/${encodeURIComponent(flowId)}/draft`),
  saveDraft: (flowId: string, input: { stepId: string; prompt: string; required: boolean; expectedVersion: number; helperText?: string | null; nextStepId?: string | null; questionSettings?: Record<string, unknown> | null; questionType?: FlowStep['questionType']; choices?: Array<{ id?: string; value: string; label: string }> }) =>
    request<{ kind: 'updated'; draftVersion: number; step: FlowStep } | { kind: 'conflict'; latestVersion: number }>(`/api/app/flows/${encodeURIComponent(flowId)}/draft`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  addDraftStep: (flowId: string, input: { expectedVersion: number; step: { kind: FlowStep['kind']; questionType: FlowStep['questionType']; prompt: string; helperText?: string | null; required?: boolean; nextStepId?: string | null; questionSettings?: Record<string, unknown> | null; choices?: Array<{ value: string; label: string }> } }) =>
    request<{ kind: 'created'; draftVersion: number; step: FlowStep } | { kind: 'conflict'; latestVersion: number }>(`/api/app/flows/${encodeURIComponent(flowId)}/draft/steps`, { method: 'POST', body: JSON.stringify(input) }),
  duplicateDraftStep: (flowId: string, stepId: string, expectedVersion: number) =>
    request<{ kind: 'created'; draftVersion: number; step: FlowStep } | { kind: 'conflict'; latestVersion: number }>(`/api/app/flows/${encodeURIComponent(flowId)}/draft/steps/${encodeURIComponent(stepId)}/duplicate`, { method: 'POST', body: JSON.stringify({ expectedVersion }) }),
  deleteDraftStep: (flowId: string, stepId: string, expectedVersion: number) =>
    request<{ kind: 'deleted'; draftVersion: number } | { kind: 'conflict'; latestVersion: number }>(`/api/app/flows/${encodeURIComponent(flowId)}/draft/steps/${encodeURIComponent(stepId)}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion }) }),
  saveFormSettings: (flowId:string,settings:import('../shared/hiddenFields').FormSettings,expectedVersion:number) => request<{kind:'updated'|'conflict'}>(`/api/app/flows/${encodeURIComponent(flowId)}/draft/settings`,{method:'PUT',body:JSON.stringify({settings,expectedVersion})}),
  saveScreen: (flowId:string,input:{stepId:string;expectedVersion:number;layout:import('../shared/screenLayout').ScreenLayout|null}) => request<{kind:'updated'|'conflict';latestVersion?:number}>(`/api/app/flows/${encodeURIComponent(flowId)}/draft/screen`,{method:'PUT',body:JSON.stringify(input)}),
  reorderDraftSteps: (flowId: string, input: { expectedVersion: number; orderedStepIds: string[] }) =>
    request<{ kind: 'reordered'; draftVersion: number } | { kind: 'conflict'; latestVersion: number }>(`/api/app/flows/${encodeURIComponent(flowId)}/draft/order`, { method: 'PUT', body: JSON.stringify(input) }),
  previewDraft: (flowId: string, answers: Record<string, unknown>, hidden?:Record<string,unknown>) =>
    request<{ preview: true; draftVersion: number; screens: Array<{ stepId: string; evaluations: Array<{ ruleId: string; matched: boolean; destinationStepId: string; trace?: ConditionTrace }>; selectedRuleId: string | null; nextStepId: string | null }>; complete: boolean; reason?: string }>(`/api/app/flows/${encodeURIComponent(flowId)}/draft/preview`, { method: 'POST', body: JSON.stringify({ answers, hidden }) }),
  publishDraft: (flowId: string, input: { expectedVersion: number; deadlineAt?: string | null; targetCompletedResponses?: number | null }) =>
    request<{ kind: 'published'; revision: { id: string; number: number }; draftVersion: number } | { kind: 'conflict'; latestVersion: number }>(`/api/app/flows/${encodeURIComponent(flowId)}/publish`, { method: 'POST', body: JSON.stringify(input) }),
  closeFlow: (flowId: string) => request<void>(`/api/app/flows/${encodeURIComponent(flowId)}/close`, { method: 'POST' }),
  reopenFlow: (flowId: string) => request<void>(`/api/app/flows/${encodeURIComponent(flowId)}/reopen`, { method: 'POST' }),
  archiveFlow: (flowId: string) => request<void>(`/api/app/flows/${encodeURIComponent(flowId)}/archive`, { method: 'POST' }),
  results: (flowId: string, revisionId?: string) => request<FlowResults>(`/api/app/flows/${encodeURIComponent(flowId)}/results${revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : ''}`),
  publicFlow: (slug: string) => request<PublicFlow>(`/api/public/flows/${encodeURIComponent(slug)}`),
  startSession: (slug: string, deviceClass: 'mobile' | 'tablet' | 'desktop', source: 'direct' | 'embed', invitationToken?: string, collectorKey?: string, accessToken?:string, presentation?:import('../shared/presentationOrder').PresentationOrder) =>
    request<{ sessionId: string; sessionToken: string; revisionId: string; flowId: string; flow: PublicFlow }>(`/api/public/flows/${encodeURIComponent(slug)}/sessions`, { method: 'POST', body: JSON.stringify({ deviceClass, source, invitationToken, collectorKey, accessToken, presentation }) }),
  advanceSession: (slug: string, input: { sessionId: string; sessionToken: string; stepId: string }) => request<void>(`/api/public/flows/${encodeURIComponent(slug)}/sessions/advance`, { method: 'POST', body: JSON.stringify(input) }),
  saveResponse: (slug: string, input: { sessionId: string; sessionToken: string; commandKey: string; email: string; currentStepId: string; answers: Array<{ stepId: string; value: unknown }>; invitationToken?: string; hidden?:Record<string,unknown> }) =>
    request<{ state: 'saved'; expiresAt: string }>(`/api/public/flows/${encodeURIComponent(slug)}/sessions/save`, { method: 'POST', body: JSON.stringify(input) }),
  resumeResponse: (slug: string, token: string) => request<SavedResponseState>(`/api/public/flows/${encodeURIComponent(slug)}/resume`, { method: 'POST', body: JSON.stringify({ token }) }),
  submitResponse: (slug: string, input: { sessionId: string; sessionToken: string; loadTime: string; prefillProof?:string; idempotencyKey: string; answers: Array<{ stepId: string; value: unknown }>; honeypot?: string; invitationToken?: string; hidden?:Record<string,unknown> }) =>
    request<{ responseId: string; idempotent: boolean; completionStepId: string | null; redirectUrl?: string | null; disposition: 'released' | 'quarantined'; payment?: { state: PaymentState; checkoutUrl?: string } }>(`/api/public/flows/${encodeURIComponent(slug)}/responses`, { method: 'POST', body: JSON.stringify(input) }),
  paymentReturn: (slug: string, input: { token: string; outcome: 'success' | 'cancel' }) => request<PaymentReturnView>(`/api/public/flows/${encodeURIComponent(slug)}/payments/return`, { method: 'POST', body: JSON.stringify(input) }),
  quarantinedResponses: (revisionId: string) => request<Array<{ id: string; quarantineReason: string | null; completedAt: string; answers: Array<{ stepId: string; value: unknown }> }>>(`/api/app/revisions/${encodeURIComponent(revisionId)}/quarantine`),
  releaseQuarantinedResponse: (responseId: string) => request<void>(`/api/app/responses/${encodeURIComponent(responseId)}/release`, { method: 'POST' }),
  deleteQuarantinedResponse: (responseId: string) => request<void>(`/api/app/responses/${encodeURIComponent(responseId)}/quarantine`, { method: 'DELETE' }),
  eraseReleasedResponse: (responseId: string) => request<void>(`/api/app/responses/${encodeURIComponent(responseId)}`, { method: 'DELETE' }),
  requestMagicLink: (email: string, returnTo?: string) => request<{ delivery: 'email' }>('/auth/magic-link', { method: 'POST', body: JSON.stringify({ email, ...(returnTo ? { returnTo } : {}) }) }),
  signOut: () => request<void>('/auth/signout', { method: 'POST', body: '{}' }),
  workspace: () => request<WorkspaceSettings>('/api/app/workspace'),
  updateWorkspace: (input: Pick<WorkspaceSettings, 'timeZone' | 'sendingWindowStart' | 'sendingWindowEnd'> & Partial<Pick<WorkspaceSettings, 'embedAllowedOrigins' | 'reminderDelayHours'>>) =>
    request<WorkspaceSettings>('/api/app/workspace', { method: 'PUT', body: JSON.stringify(input) }),
  operators: () => request<Operator[]>('/api/app/operators'),
  inviteOperator: (input: { email: string; displayName: string }) => request<{ id: string }>('/api/app/operators', { method: 'POST', body: JSON.stringify(input) }),
  removeOperator: (operatorId: string) => request<void>(`/api/app/operators/${encodeURIComponent(operatorId)}`, { method: 'DELETE' }),
}

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'sav'
import type { LedgerFilter } from '../shared/reportFilters'
export type { LedgerFilter } from '../shared/reportFilters'
export type LedgerResponse = { payment?: import('../shared/payments').LedgerPayment; presentedOrder:import('../shared/presentationOrder').PresentationOrder|null;
  verifiedEmail?:string
  verifiedSubject?:string; calculations:Array<{id:string;name:string;type:'number'|'text';value:number|string|null}>; hiddenFields:Array<{id:string;name:string;type:import('../shared/hiddenFields').HiddenField['type'];value:string|number|boolean}>;identityMode:'anonymous'|'identified';discardedParameters:number; collector: { id: string; name: string; channel: string }; omittedQuestions: Array<{ stepId: string; label: string; position: number; questionType?: string }>; participant?: { id: string; name: string | null; email: string | null }; id: string; revisionId: string; revisionNumber: number; source: string; startedAt: string | null; completedAt: string; releasedAt: string | null; state: 'released' | 'quarantined'; quarantineReason: string | null; answers: Array<{ prefill?: import('../shared/knownDataPrefill').PrefillMarker; stepId: string; label: string; position: number; questionType: string; value: unknown; displayValue: string }> }
export type Ledger = { flow: { id: string; title: string; slug: string }; cutoff: string; filter: LedgerFilter; revisions: Array<{ calculations:Array<Pick<import('../shared/calculations').Calculation,'id'|'name'|'type'>>; hiddenFields:Array<Pick<import('../shared/hiddenFields').HiddenField,'id'|'name'|'type'>>; id: string; number: number; isCurrent: number }>; total: number; responses: LedgerResponse[] }
export type QuestionReport = { revisionId?: string; importedAnswered: number; summary: import('../features/reporting/answerSummary').AnswerSummary; id: string; prompt: string; questionType: string | null; reached: number; dropped: number; answered: number; choices: Array<{ id: string; label: string }>; distribution: Array<{ value: unknown; label: string; count: number }>; distributionLabel: string }
function query(filter: LedgerFilter) { return new URLSearchParams(Object.entries(filter).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString() }
export type RevisionComparison = { revisionCount?: number; offset?: number; nextOffset?: number; flow: { id: string; title: string; slug: string }; revisions: Array<{ id: string; number: number; isCurrent: number }>; questions: Array<{ id: string; answered: number; eligibleResponses: number; versions: Array<QuestionReport & { revisionId: string; eligibleResponses: number }> }> }

export const reportingApi = {
  devices: (flowId: string, filter: LedgerFilter) => request<import('../features/reporting/devices').DeviceReport>(`/api/app/flows/${encodeURIComponent(flowId)}/devices?${query(filter)}`),
  compareRevisions: (flowId: string, offset = 0) => request<RevisionComparison>(`/api/app/flows/${encodeURIComponent(flowId)}/questions/compare?offset=${offset}`),
  ledger: (flowId: string, filter: LedgerFilter = {}) => request<Ledger>(`/api/app/flows/${encodeURIComponent(flowId)}/ledger?${query(filter)}`),
  questions: (flowId: string, revisionId: string) => request<QuestionReport[]>(`/api/app/flows/${encodeURIComponent(flowId)}/questions?revisionId=${encodeURIComponent(revisionId)}`),
  textPage: (flowId: string, input: { revisionId:string;questionId:string;search:string;cursor?:string;countOnly?:boolean }, signal?: AbortSignal) => request<{texts:string[];cursor?:string;scanning:boolean;countCursor?:string;matching?:number}>(`/api/app/flows/${encodeURIComponent(flowId)}/questions/text`,{method:'POST',body:JSON.stringify(input),signal}),
  crosstab: (flowId: string, input: { revisionId: string; rows: string; columns: string } & LedgerFilter) => request<import('../features/reporting').Crosstab>(`/api/app/flows/${encodeURIComponent(flowId)}/crosstab?${query(input)}`),
  startExport: (flowId: string, filter: LedgerFilter, format: ExportFormat, includeAutomatedExclusions = false) => request<{token:string;cutoff:string;total:number;excludedQuarantined:number;includedQuarantined:number;filename:string;format:ExportFormat}>(`/api/app/flows/${encodeURIComponent(flowId)}/responses/export/start`,{method:'POST',body:JSON.stringify({...filter,format,includeAutomatedExclusions})}),
}
