import { formSettings, type HiddenField } from '../../shared/hiddenFields'
import type { Calculation } from '../../shared/calculations'
import { responseScope, type ResponseSelection } from './scope'
import type { LedgerFilter } from './repository'

/**
 * The question inventory of the revisions an export selects (LEDG-005), newest revision first.
 * Questions are keyed by stable step ID and type and never merged across different IDs (RSLT-005);
 * choices are keyed by stable choice ID, so one choice keeps one code in every revision.
 */
export type InventoryChoice = { id: string; label: string; value: string; code: number; revisions: Set<string> }
export type InventoryQuestion = { key: string; id: string; type: string; prompt: string; settings: Record<string, unknown>; name: string; choices: InventoryChoice[]; revisions: Set<string> }
export type InventoryStep = { revisionId: string; revisionNumber: number; id: string; position: number; type: string; prompt: string; question: InventoryQuestion }
export type ExportInventory = { revisions: Array<{ id: string; number: number }>; questions: InventoryQuestion[]; steps: InventoryStep[]; hiddenFields: Array<Pick<HiddenField, 'id' | 'name' | 'type'>>; calculations: Array<Pick<Calculation, 'id' | 'name' | 'type'>>; revisionIds: string[] }

export async function exportInventory(db: D1Database, workspaceId: string, flowId: string, filter: LedgerFilter, cutoff: string, state: ResponseSelection): Promise<ExportInventory> {
  const { where, bindings } = responseScope(workspaceId, flowId, filter, cutoff, state)
  const revisions = (await db.prepare(`SELECT v.id, v.number, v.form_settings_json AS settingsJson FROM flow_revisions v WHERE v.flow_id = ? AND v.id IN (SELECT DISTINCT r.revision_id FROM responses r WHERE ${where}) ORDER BY v.number DESC`).bind(flowId, ...bindings).all<{ id: string; number: number; settingsJson: string }>()).results
  const empty: ExportInventory = { revisions: [], questions: [], steps: [], hiddenFields: [], calculations: [], revisionIds: [] }
  if (!revisions.length) return empty
  const marks = revisions.map(() => '?').join(','), ids = revisions.map(revision => revision.id)
  const [steps, choices] = await db.batch([
    db.prepare(`SELECT s.revision_id AS revisionId, s.stable_id AS id, s.prompt, s.question_type AS type, s.question_settings_json AS settingsJson, s.position FROM flow_steps s WHERE s.kind = 'question' AND s.revision_id IN (${marks}) ORDER BY s.position, s.stable_id`).bind(...ids),
    db.prepare(`SELECT s.revision_id AS revisionId, s.stable_id AS stepId, c.stable_id AS id, c.label, c.value FROM choice_options c JOIN flow_steps s ON s.id = c.step_id WHERE s.revision_id IN (${marks}) ORDER BY c.position, c.stable_id`).bind(...ids),
  ])
  const number = new Map(revisions.map(revision => [revision.id, revision.number]))
  const order = (a: { revisionId: string }, b: { revisionId: string }) => number.get(b.revisionId)! - number.get(a.revisionId)!
  const questions = new Map<string, InventoryQuestion>(), inventorySteps: InventoryStep[] = []
  for (const step of (steps.results as Array<{ revisionId: string; id: string; prompt: string; type: string; settingsJson: string | null; position: number }>).sort(order)) {
    const key = `${step.id}\0${step.type}`
    const question = questions.get(key) ?? { key, id: step.id, type: step.type, prompt: step.prompt, settings: JSON.parse(step.settingsJson ?? '{}') as Record<string, unknown>, name: '', choices: [], revisions: new Set<string>() }
    question.revisions.add(step.revisionId); questions.set(key, question)
    inventorySteps.push({ revisionId: step.revisionId, revisionNumber: number.get(step.revisionId)!, id: step.id, position: step.position, type: step.type, prompt: step.prompt, question })
  }
  const byStep = new Map<string, InventoryQuestion[]>()
  for (const question of questions.values()) byStep.set(question.id, [...byStep.get(question.id) ?? [], question])
  for (const choice of (choices.results as Array<{ revisionId: string; stepId: string; id: string; label: string; value: string }>).sort(order)) {
    for (const question of byStep.get(choice.stepId) ?? []) {
      if (!question.revisions.has(choice.revisionId)) continue
      const known = question.choices.find(item => item.id === choice.id)
      if (known) known.revisions.add(choice.revisionId)
      else question.choices.push({ id: choice.id, label: choice.label, value: choice.value, code: question.choices.length + 1, revisions: new Set([choice.revisionId]) })
    }
  }
  const ordered = [...questions.values()]
  ordered.forEach((question, index) => { question.name = `q${index + 1}` })
  const hiddenFields = new Map<string, Pick<HiddenField, 'id' | 'name' | 'type'>>(), calculations = new Map<string, Pick<Calculation, 'id' | 'name' | 'type'>>()
  for (const revision of revisions) {
    const settings = formSettings(revision.settingsJson)
    for (const field of settings.hiddenFields) if (!hiddenFields.has(field.id)) hiddenFields.set(field.id, { id: field.id, name: field.name, type: field.type })
    for (const calculation of settings.calculations ?? []) if (!calculations.has(calculation.id)) calculations.set(calculation.id, { id: calculation.id, name: calculation.name, type: calculation.type })
  }
  return { revisions: revisions.map(({ id, number }) => ({ id, number })), questions: ordered, steps: inventorySteps, hiddenFields: [...hiddenFields.values()], calculations: [...calculations.values()], revisionIds: ids }
}

/** Sheet two of the XLSX: one row per question and revision, and one per choice it offered. */
export function* questionMetadata(inventory: ExportInventory): Generator<Array<string | number>> {
  for (const step of inventory.steps) {
    const offered = step.question.choices.filter(choice => choice.revisions.has(step.revisionId))
    const base = [step.revisionId, step.revisionNumber, step.id, step.position, step.type, step.prompt]
    if (!offered.length) yield [...base, '', '', '', step.question.name, '']
    for (const choice of offered) yield [...base, choice.id, choice.value, choice.label, step.question.name, choice.code]
  }
}
