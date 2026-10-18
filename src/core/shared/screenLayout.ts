import type { FlowStep } from '../app/api'
import type { Condition } from './conditions'
import { remapCondition } from './conditions'
import { conditionShape } from './conditionValidation'

export type ScreenLayout = { kind: 'page' | 'group'; title: string; description?: string; questionIds: string[] }
export type ResponseScreen = { id: string; layout?: ScreenLayout; steps: FlowStep[] }

export function screenLayout(step: FlowStep): ScreenLayout | undefined {
  return step.questionSettings?.screen as ScreenLayout | undefined
}
export function visibilityCondition(step: Pick<FlowStep, 'questionSettings'>): Condition | undefined {
  return step.questionSettings?.showWhen as Condition | undefined
}
export function layoutSettingsValid(settings: Record<string, unknown>) {
  const layout = settings.screen as ScreenLayout | undefined
  if (layout !== undefined && (!layout || typeof layout !== 'object' || Array.isArray(layout) || !['page','group'].includes(layout.kind)
    || typeof layout.title !== 'string' || !layout.title.trim() || layout.title.length > 200
    || (layout.description !== undefined && (typeof layout.description !== 'string' || layout.description.length > 1000))
    || !Array.isArray(layout.questionIds) || !layout.questionIds.length || layout.questionIds.length > 250
    || layout.questionIds.some(id => typeof id !== 'string' || !id || id.length > 200) || new Set(layout.questionIds).size !== layout.questionIds.length
    || Object.keys(layout).some(key => !['kind','title','description','questionIds'].includes(key)))) return false
  return settings.showWhen === undefined || conditionShape(settings.showWhen)
}
export function responseScreens(steps: FlowStep[], path: FlowStep[]): ResponseScreen[] {
  const owners = new Map<string, {id:string;layout:ScreenLayout}>()
  for (const step of steps) {
    const layout = screenLayout(step)
    if (layout) for (const id of layout.questionIds) owners.set(id, {id:step.id,layout})
  }
  const screens: ResponseScreen[] = []
  for (const step of path) {
    const owner = owners.get(step.id), id = owner?.id ?? step.id
    const previous = screens.at(-1)
    if (previous?.id === id) previous.steps.push(step)
    else screens.push({id,layout:owner?.layout,steps:[step]})
  }
  return screens
}
export function remapLayoutSettings(json: string | null, steps: Map<string,string>, choices: Map<string,string>) {
  if (!json) return json
  const settings = JSON.parse(json) as Record<string,unknown>
  if (settings.screen) {
    const layout = settings.screen as ScreenLayout
    settings.screen = {...layout,questionIds:layout.questionIds.map(id => steps.get(id) ?? id)}
  }
  if (settings.showWhen) settings.showWhen = remapCondition(settings.showWhen as Condition,steps,choices)
  return JSON.stringify(settings)
}
