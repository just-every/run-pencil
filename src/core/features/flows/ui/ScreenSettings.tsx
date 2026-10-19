import { useState } from 'react'
import type { BuilderDraft, FlowStep } from '../../../app/api'
import type { Condition } from '../../../shared/conditions'
import { screenLayout, visibilityCondition, type ScreenLayout } from '../../../shared/screenLayout'
import { ConditionEditor, firstCondition } from './ConditionEditor'

type Props = {
  draft: BuilderDraft
  selected: FlowStep
  disabled: boolean
  allowGroups?: boolean
  saveDisabled?: boolean
  onSave: (layout: ScreenLayout | null) => void
  onVisibility: (condition: Condition | undefined) => void
}

export function ScreenSettings(props: Props) {
  if (props.selected.kind !== 'question') return null
  return <ScreenSettingsEditor key={`${props.selected.id}:${JSON.stringify(screenLayout(props.selected))}`} {...props} />
}

function ScreenSettingsEditor({ draft, selected, disabled, allowGroups = false, saveDisabled = false, onSave, onVisibility }: Props) {
  const layout = screenLayout(selected)
  const [kind, setKind] = useState<'standalone' | ScreenLayout['kind']>(layout?.kind ?? 'standalone')
  const [title, setTitle] = useState(layout?.title ?? '')
  const [description, setDescription] = useState(layout?.description ?? '')
  const [randomize, setRandomize] = useState(layout?.randomize ?? false)
  const [lastId, setLastId] = useState(layout?.questionIds.at(-1) ?? selected.id)
  const steps = [...draft.steps].sort((a, b) => a.position - b.position)
  const anchor = steps.find(step => step.id !== selected.id && screenLayout(step)?.questionIds.includes(selected.id))
  const earlier = steps.filter(step => step.kind === 'question' && step.position < selected.position)
  const condition = visibilityCondition(selected)
  const available: FlowStep[] = []
  for (const step of steps.slice(steps.findIndex(step => step.id === selected.id))) {
    if (step.kind !== 'question' || steps.some(owner => owner.id !== selected.id && screenLayout(owner)?.questionIds.includes(step.id))) break
    available.push(step)
  }
  const lastIndex = available.findIndex(step => step.id === lastId)
  const nextLayout: ScreenLayout | null = kind === 'standalone' ? null : {
    kind, title: title.trim(), ...(randomize ? { randomize: true } : {}), ...(description.trim() ? { description: description.trim() } : {}),
    questionIds: available.slice(0, lastIndex + 1).map(step => step.id),
  }
  const invalid = nextLayout !== null && (!nextLayout.title || lastIndex < 0)
  const unchanged = JSON.stringify(nextLayout) === JSON.stringify(layout ?? null)

  return <details className="screen-layout-settings"><summary className="focus-ring">Screen layout and visibility</summary><fieldset className="quiet-panel" disabled={disabled}>
    <legend>Screen layout</legend>
    {anchor ? <>
      <p>This question belongs to <strong>{screenLayout(anchor)!.title}</strong>.</p>
      <p className="muted">Select the first question, “{anchor.prompt}”, to change this screen's layout or included questions.</p>
      <label className="toggle-row">
        <input type="checkbox" checked={condition !== undefined} disabled={!earlier.length} onChange={event => onVisibility(event.target.checked ? firstCondition(earlier[earlier.length - 1], draft) : undefined)} />
        Show this question conditionally
      </label>
      {condition && earlier.length ? <ConditionEditor condition={condition} draft={draft} operands={earlier} onChange={onVisibility} /> : null}
      <p className="muted">Conditions can use earlier answers, including answers on this screen. Save the question to apply visibility changes.</p>
    </> : <>
      <label className="inspector-field">Layout
        <select aria-label="Layout" className="text-input" value={kind} onChange={event => setKind(event.target.value as typeof kind)}>
          <option value="standalone">Standalone question</option>
          <option value="page">Classic page</option>
          {allowGroups || layout?.kind === 'group' ? <option value="group" disabled={!allowGroups}>Question group</option> : null}
        </select>
      </label>
      {kind !== 'standalone' ? <>
        <label className="inspector-field">Screen title
          <input className="text-input" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} />
        </label>
        <label className="inspector-field">Screen description
          <textarea className="text-input" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} />
        </label>
        <label className="inspector-field">Last included question
          <select aria-label="Last included question" className="text-input" value={lastId} onChange={event => setLastId(event.target.value)}>
            {available.map(step => <option key={step.id} value={step.id}>{step.prompt}</option>)}
          </select>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={randomize} onChange={event => setRandomize(event.target.checked)} />
          Randomize question order in this block
        </label>
        <p className="muted">Includes this question and every consecutive question through the selected question.</p>
      </> : null}
      <button className="secondary-button" type="button" disabled={saveDisabled || invalid || unchanged} onClick={() => onSave(nextLayout)}>Save screen layout</button>
    </>}
  </fieldset></details>
}
