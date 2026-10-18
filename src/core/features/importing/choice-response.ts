import type { ImportStep } from './model'

type OtherAnswer = { choiceIds: string[]; otherText: string }
export function otherChoiceId(step: ImportStep): string | undefined {
  return typeof step.settings.otherChoiceId === 'string' ? step.settings.otherChoiceId : undefined
}
export function importedChoiceIds(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value as string[]
  return (value as OtherAnswer | undefined)?.choiceIds ?? []
}
export function importedOtherText(value: unknown): string | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as OtherAnswer).otherText : undefined
}
export function choiceValue(step: ImportStep, ids: string[], otherText?: string): unknown {
  const other = otherChoiceId(step)
  if (other && ids.includes(other)) return { choiceIds: ids, otherText: otherText ?? '' }
  return step.questionType === 'multiple_choice' || step.questionType === 'priority' ? ids : ids[0]
}

export function choiceResponse(value: string, step: ImportStep, google: boolean): unknown {
  const other = otherChoiceId(step)
  const matches = (label: string) => step.choices.filter(c => c.label === label || (!google && c.sourceId === label))
  const find = (label: string) => {
    const found = matches(label)
    if (found.length !== 1) throw new Error('Choice must match exactly one label or reference.')
    return found[0].id
  }
  if (['single_choice', 'dropdown'].includes(step.questionType!)) {
    const found = matches(value)
    if (!found.length && other) return choiceValue(step, [other], value)
    return choiceValue(step, [find(value)])
  }
  if (google && step.questionType === 'multiple_choice') {
    // CSV-only reconstruction establishes whole-cell options, never checkbox tokens.
    if (step.sourceType !== 'choiceQuestion') return [find(value)]
    if (step.choices.some(c => c.label.includes(', ') && value.includes(c.label))) throw new Error('Checkbox cell contains a separator-bearing option label; the export is ambiguous and cannot be decoded.')
    const labels = value.split(', ')
    if (new Set(labels).size !== labels.length) throw new Error('Checkbox cell repeats an option.')
    const unknown = labels.filter(label => matches(label).length === 0)
    if (unknown.length && other) {
      // A comma-space can belong to the write-in itself. Inferring its boundaries
      // would silently alter either the selected IDs or the respondent's text.
      if (labels.length !== 1) throw new Error('Checkbox Other text shares a cell with comma-space separators; the export cannot identify its boundaries. Separate the confirmed write-in from the fixed selections before importing.')
      return choiceValue(step, [other], value)
    }
    return choiceValue(step, labels.map(label => {
      const found = matches(label)
      if (found.length !== 1) throw new Error('Checkbox cell must match whole known option labels separated by comma-space; ambiguous or unknown labels are refused.')
      return found[0].id
    }))
  }
  if (step.questionType === 'priority' || step.questionType === 'multiple_choice') {
    let values: unknown
    try { values = JSON.parse(value) } catch { throw new Error('Use a JSON array of exact choice labels/references, or map separate choice columns. Commas are not separators.') }
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) throw new Error('Use a JSON array of choice labels/references.')
    const unknown = values.filter(label => matches(label).length === 0)
    if (unknown.length && other) {
      if (unknown.length !== 1) throw new Error('Only one Other write-in can accompany the fixed selections.')
      return choiceValue(step, values.map(label => matches(label).length ? find(label) : other), unknown[0])
    }
    return choiceValue(step, values.map(find))
  }
  throw new Error('Unsupported answer type.')
}
