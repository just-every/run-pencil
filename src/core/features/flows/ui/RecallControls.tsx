import { isRecallKey } from '../../../shared/recallSyntax'
import type { FlowStep } from '../../../app/api'
import './choice-settings.css'

export type RecallSource = { key: string; prompt: string }
export function RecallInsert({ sources, label, disabled, onInsert }: { sources: RecallSource[]; label: string; disabled: boolean; onInsert: (token: string) => void }) {
  return sources.length ? <label className="inspector-field">{label}<select aria-label={label} className="text-input" disabled={disabled} value="" onChange={event => { if (event.target.value) onInsert(`{{${event.target.value}}}`) }}><option value="">Choose an earlier answer…</option>{sources.map(source => <option key={source.key} value={source.key}>{source.key} · {source.prompt}</option>)}</select></label> : null
}
export function RecallControls({ step, sources, settings, disabled, onName, onInsert }: { step: FlowStep; sources: RecallSource[]; settings: Record<string, unknown>; disabled: boolean; onName: (key: string) => void; onInsert: (token: string) => void }) {
  const name = typeof settings.recallKey === 'string' ? settings.recallKey : ''
  return <details className="recall-controls">
    <summary className="focus-ring">Answer recall</summary>
    {step.kind === 'question' ? <><label className="inspector-field">Answer reference name (optional)<input className="text-input" maxLength={40} value={name} disabled={disabled} onChange={event => onName(event.target.value)} placeholder="e.g. name" autoCapitalize="none" spellCheck={false} /></label><p className="muted">Name this answer to use it in later prompts, helper text or choice labels. Start with a letter; use letters, digits and underscores. If you rename it, update its references.</p>{name && !isRecallKey(name) ? <p className="status-note" role="alert">Choose a reference name starting with a letter, using only letters, digits and underscores.</p> : null}</> : null}
    <RecallInsert sources={sources} label="Insert earlier answer into prompt" disabled={disabled} onInsert={onInsert} />
    {!sources.length ? <p className="muted">Give an earlier question a reference name to insert its answer here.</p> : <p className="muted">You can also type a reference such as {'{{name}}'} in helper text. Skipped answers appear blank. Answer text is displayed exactly as text.</p>}
  </details>
}
