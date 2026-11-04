import type { ExportInventory } from './exportInventory'
import type { LedgerResponse } from './repository'

export type QuestionColumn = { id: string; type: string; label: string }

/** Stable identities keep renamed, removed and identically named questions separate. */
export function questionColumns(inventory: ExportInventory, reserved: string[]): QuestionColumn[] {
  const counts = new Map<string, number>()
  for (const question of inventory.questions) counts.set(question.prompt, (counts.get(question.prompt) ?? 0) + 1)
  const used = new Set(reserved)
  return inventory.questions.map(question => {
    let label = question.prompt
    if (counts.get(label)! > 1 || used.has(label)) label = `${label} [${question.id} · ${question.type}]`
    while (used.has(label)) label += ' (question)'
    used.add(label)
    return { id: question.id, type: question.type, label }
  })
}

export function questionRecord(row: LedgerResponse, columns: QuestionColumn[]): Array<string | number> {
  const answers = new Map(row.answers.map(answer => [`${answer.stepId}\0${answer.questionType}`, answer]))
  return columns.map(column => {
    const answer = answers.get(`${column.id}\0${column.type}`)
    return answer ? typeof answer.value === 'number' ? answer.value : answer.displayValue : ''
  })
}
