import { workflowChips, type SubmissionOptions } from '../../submissions'
import type { LedgerFilter, QuestionReport } from '../../../app/api'
import type { Collector } from '../../collectors'
import type { FilterChip } from '../../../shared/ui/FilterBar'
import { civilParts } from '../../../shared/civilTime'

/** The ledger's sources in the words of its Source filter. */
export const sourceLabels: Record<string, string> = { direct: 'Direct link', embed: 'Embed', invitation: 'Invitation', unknown: 'Historical source unavailable', imported: 'Imported' }
const participantLabels: Record<string, string> = { eligible: 'Eligible', 'opted-out': 'Opted out', bounced: 'Bounced' }

/** Every filter in force on the ledger as a removable chip. */
export function ledgerChips({ filter, onChange, options, collectors, questions, hiddenFields, calculations, timeZone }: {
  filter: LedgerFilter; onChange: (next: LedgerFilter) => void; options?: SubmissionOptions; collectors: Collector[]; questions: QuestionReport[]
  hiddenFields: Array<{ id: string; name: string }>; calculations: Array<{ id: string; name: string }>; timeZone: string
}): FilterChip[] {
  const drop = (change: Partial<LedgerFilter>) => () => onChange({ ...filter, ...change, offset: 0 })
  const chips: FilterChip[] = []
  if (filter.search) chips.push({ key: 'Search', label: `Search: ${filter.search}`, onRemove: drop({ search: undefined }) })
  if (filter.deviceClass) chips.push({ key: 'Device class', label: `Device: ${filter.deviceClass[0].toUpperCase()}${filter.deviceClass.slice(1)}`, onRemove: drop({ deviceClass: undefined }) })
  chips.push(...workflowChips(options, filter, onChange))
  if (filter.collectorId) chips.push({ key: 'Collector', label: `Collector: ${collectors.find(item => item.id === filter.collectorId)?.name ?? 'Unavailable collector'}`, onRemove: drop({ collectorId: undefined }) })
  if (filter.source) chips.push({ key: 'Source', label: `Source: ${sourceLabels[filter.source] ?? filter.source}`, onRemove: drop({ source: undefined }) })
  if (filter.participantStatus) chips.push({ key: 'Participant status', label: `Participants: ${participantLabels[filter.participantStatus]}`, onRemove: drop({ participantStatus: undefined }) })
  if (filter.from) chips.push({ key: 'From', label: `From: ${civilParts(new Date(filter.from), timeZone).day}`, onRemove: drop({ from: undefined }) })
  if (filter.to) chips.push({ key: 'Through', label: `Through: ${civilParts(new Date(filter.to), timeZone).day}`, onRemove: drop({ to: undefined }) })
  if (filter.answerStepId) {
    const id = filter.answerStepId
    const name = questions.find(question => question.id === id)?.prompt ?? hiddenFields.find(field => `hidden:${field.id}` === id)?.name ?? calculations.find(value => `variable:${value.id}` === id)?.name ?? 'Unavailable question'
    chips.push({ key: 'Answer', label: `Answer: ${name}`, onRemove: drop({ answerStepId: undefined, answerValue: undefined }) })
  }
  if (filter.codeId) chips.push({ key: 'Code', label: 'Code filter', onRemove: drop({ codeId: undefined }) })
  return chips
}
