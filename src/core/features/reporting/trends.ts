import { sqlSpecialChoiceText } from './choiceReports'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { calendarDate, typeSettingsValid } from '../../shared/questionTypes'
import { checkGeneration, generation } from './cursor'
import type { LedgerFilter } from './repository'
import { trendPeriods, type TrendPeriod, type TrendUnit } from './trendPeriods'
import { scoreTrendTypes, shareTrendTypes, trendAggregation, type TrendAggregate } from './trendQueries'

export type TrendRevision = { revisionId: string; revisionNumber: number; publishedAt: string; prompt: string | null; questionType: string | null; shareLabel: string | null; settings: Record<string, unknown> }
export type TrendPoint = TrendPeriod & { denominator: number; numerator: number | null; value: number | null; suppressed: boolean; revisions: TrendRevision[] }
export type TrendInput = { db: D1Database; workspaceId: string; flowId: string; filter: LedgerFilter; cutoff: string; from: string; to: string; unit: TrendUnit; stableStepId: string; metric: 'score' | 'share'; shareValue?: string | number | boolean; minimum: number }
export type TrendReport = { filter:LedgerFilter; collector:{id:string;name:string}|null; zone: string; unit: TrendUnit; from: string; to: string; cutoff: string; stableStepId: string; questionType: string; metric: 'score' | 'share'; minimum: number; shareValue?: string | number | boolean; revisions: TrendRevision[]; periods: TrendPoint[] }
type RevisionRow = Omit<TrendRevision, 'settings'> & { settingsJson: string | null }

function validateShare(type: string, value: unknown, revisions: TrendRevision[]) {
  if (['nps','csat','ces','rating','number','emoji_rating'].includes(type)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationError('Choose a finite numeric answer for this trend.')
  } else if (['yes_no','consent','thumbs_rating'].includes(type)) {
    if (typeof value !== 'boolean') throw new ValidationError('Choose a true or false answer for this trend.')
  } else if (typeof value !== 'string' || value.length > 5000) throw new ValidationError('Choose a bounded text answer or stable choice ID for this trend.')
  if (['single_choice','dropdown','multiple_choice'].includes(type) && revisions.some(revision => revision.questionType && revision.shareLabel === null)) throw new ValidationError('The selected stable choice ID is not present in every selected question revision. Choose a revision containing that choice.')
}

/** One bounded SQL aggregate, with revision metadata; individual answers never leave D1. */
export async function reportTrends(input: TrendInput): Promise<TrendReport> {
  const { db } = input
  if (!Number.isSafeInteger(input.minimum) || input.minimum < 1 || input.minimum > 1_000_000) throw new ValidationError('Choose a minimum period size from 1 to 1000000.')
  if (!['score','share'].includes(input.metric)) throw new ValidationError('Choose a score or answer-share trend.')
  if (!input.stableStepId || input.stableStepId.length > 200) throw new ValidationError('Choose a valid stable question ID for trends.')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.cutoff) || !calendarDate(input.cutoff.slice(0,10)) || !Number.isFinite(Date.parse(input.cutoff))) throw new ValidationError('Choose a valid trend evidence cutoff instant.')
  const cutoff = new Date(input.cutoff).toISOString()
  const workspace = await db.prepare('SELECT w.time_zone AS zone FROM flows f JOIN workspaces w ON w.id=f.workspace_id WHERE f.id=? AND f.workspace_id=?').bind(input.flowId,input.workspaceId).first<{zone:string}>()
  if (!workspace) throw new NotFoundError('This flow is not available in your workspace.')
  const periods = trendPeriods(input.from,input.to,input.unit,workspace.zone)
  const scope = { workspaceId: input.workspaceId, flowId: input.flowId, cutoff, sessionId: '', generation: await generation(db,input.workspaceId) }
  const collector=input.filter.collectorId ? await db.prepare('SELECT id,name FROM collectors WHERE id=? AND flow_id=?').bind(input.filter.collectorId,input.flowId).first<{id:string;name:string}>() : null
  if(input.filter.collectorId && !collector)throw new NotFoundError('This collector is not part of the selected flow.')
  const selected = await db.prepare(`SELECT v.id AS revisionId,v.number AS revisionNumber,v.published_at AS publishedAt,s.prompt,s.question_type AS questionType,s.question_settings_json AS settingsJson,
      (SELECT c.label FROM choice_options c WHERE c.step_id=s.id AND c.stable_id=?) AS shareLabel
    FROM flow_revisions v LEFT JOIN flow_steps s ON s.revision_id=v.id AND s.stable_id=? AND s.kind='question'
    WHERE v.flow_id=? AND v.state='published' AND v.published_at<=? ${input.filter.revisionId ? 'AND v.id=?' : ''}
    ORDER BY v.published_at,v.number LIMIT 401`)
    .bind(typeof input.shareValue === 'string' ? input.shareValue : '',input.stableStepId,input.flowId,cutoff,...(input.filter.revisionId ? [input.filter.revisionId] : [])).all<RevisionRow>()
  if (selected.results.length > 400) throw new ValidationError('This trend spans more than 400 revisions. Choose a specific revision.')
  const revisions: TrendRevision[] = selected.results.map(({settingsJson,...revision}) => {
    const settings: unknown = settingsJson === null ? {} : JSON.parse(settingsJson)
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || !typeSettingsValid(revision.questionType,settings as Record<string,unknown>)) throw new ValidationError('A selected revision has invalid question settings; its trend cannot be reported.')
    return {...revision,settings:settings as Record<string,unknown>}
  })
  const types = [...new Set(revisions.flatMap(revision => revision.questionType ? [revision.questionType] : []))]
  if (!types.length) throw new NotFoundError('This stable question ID is not in a selected published revision.')
  if (types.length !== 1) throw new ValidationError('This question changes type between revisions. Choose a single revision for the trend.')
  const type = types[0]
  const allowed: readonly string[] = input.metric === 'score' ? scoreTrendTypes : shareTrendTypes
  if (!allowed.includes(type)) throw new ValidationError('This question does not support the selected trend metric.')
  if (input.metric === 'share') validateShare(type,input.shareValue,revisions)
  const special: string[] = []
  const specialRevisions = revisions.filter(revision => revision.settings.otherChoiceId !== undefined || revision.settings.noneChoiceId !== undefined)
  const choices = specialRevisions.length ? (await db.prepare('SELECT c.stable_id AS id,s.stable_id AS stepId,s.revision_id AS revisionId FROM choice_options c JOIN flow_steps s ON s.id=c.step_id WHERE s.revision_id IN (SELECT value FROM json_each(?)) AND s.stable_id=?').bind(JSON.stringify(specialRevisions.map(revision => revision.revisionId)),input.stableStepId).all<{id:string;stepId:string;revisionId:string}>()).results : []
  for (const revision of specialRevisions) {
    const valid = sqlSpecialChoiceText([{id:input.stableStepId,questionType:revision.questionType,settingsJson:JSON.stringify(revision.settings)}], choices.filter(choice => choice.revisionId === revision.revisionId))
    if (valid !== '1') special.push(`WHEN '${revision.revisionId.replaceAll("'", "''")}' THEN ${valid}`)
  }
  const otherTextValid = special.length ? `(CASE r.revision_id ${special.join(' ')} ELSE 1 END)` : '1'
  const aggregate = await trendAggregation(db,{...input,cutoff,type,periods,otherTextValid}).all<TrendAggregate>()
  if (aggregate.results.some(row => row.invalid || row.denominator && (row.value === null || !Number.isFinite(row.value)))) throw new ValidationError('Invalid retained answer. Trends cannot be reported until it is corrected or erased.')
  await checkGeneration(db,scope)
  const byPeriod = new Map(aggregate.results.map(row => [row.period,row]))
  const points: TrendPoint[] = periods.map((period,index) => {
    const row = byPeriod.get(index), denominator = row?.denominator ?? 0, suppressed = denominator < input.minimum
    return {...period,denominator,numerator:suppressed ? null : row?.numerator ?? null,value:suppressed ? null : row!.value,suppressed,revisions:revisions.filter(revision => revision.publishedAt>=period.startAt && revision.publishedAt<period.endAt)}
  })
  return {filter:{...input.filter},collector,zone:workspace.zone,unit:input.unit,from:input.from,to:input.to,cutoff,stableStepId:input.stableStepId,questionType:type,metric:input.metric,minimum:input.minimum,...(input.metric === 'share' ? {shareValue:input.shareValue} : {}),revisions,periods:points}
}
