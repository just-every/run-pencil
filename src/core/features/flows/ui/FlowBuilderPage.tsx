import { DistributionPanel } from '../../distribution'
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Plus, Save, Send, Trash2 } from 'lucide-react'
import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { zonedInstant } from '../../../shared/timeZone'
import { BranchEditor } from './BranchEditor'
import { DraftPreview } from './DraftPreview'
import { FlowSharePanel } from './FlowSharePanel'
import { api, ApiError, type BuilderDraft, type FlowStep } from '../../../app/api'

function stepLabel(step: FlowStep) {
  if (step.kind === 'welcome') return 'Welcome'
  if (step.kind === 'completion') return 'Completion'
  return step.questionType?.replace('_', ' ') ?? 'Question'
}

export function FlowBuilderPage() {
  const { flowId } = useParams({ from: '/app/flows/$flowId/builder' })
  const [draft, setDraft] = useState<BuilderDraft>()
  const [draftRead, setDraftRead] = useState(0)
  const [selectedId, setSelectedId] = useState<string>()
  const [prompt, setPrompt] = useState('')
  const [helperText, setHelperText] = useState('')
  const [nextStepId, setNextStepId] = useState<string | null>(null)
  const [required, setRequired] = useState(false)
  const [questionType, setQuestionType] = useState<FlowStep['questionType']>(null)
  const [choices, setChoices] = useState<Array<{ id?: string; value: string; label: string }>>([])
  const [settingsText, setSettingsText] = useState('')
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string }>()
  const [savingDraft, setSaving] = useState(false)
  const [branchSaving, setBranchSaving] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const saving = savingDraft || branchSaving || loadingDraft
  const mounted = useRef(true)
  const loadVersion = useRef(0)
  const [branchDirty, setBranchDirty] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [timeZone, setTimeZone] = useState<string>()
  const [timeZoneError, setTimeZoneError] = useState<string>()
  const [deadline, setDeadline] = useState('')
  const [target, setTarget] = useState('')

  const load = async () => {
    const version = ++loadVersion.current
    setLoadingDraft(true)
    await api.builder(flowId).then((next) => {
      if (!mounted.current || loadVersion.current !== version) return
      setDraft(next)
      setDraftRead((previous) => previous + 1)
      const initial = next.steps.find((step) => step.kind === 'question') ?? next.steps[0]
      setSelectedId((previous) => previous && next.steps.some((step) => step.id === previous) ? previous : initial?.id)
    }).catch((reason: unknown) => { if (mounted.current && loadVersion.current === version) setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : 'The draft could not load.' }) }).finally(() => { if (mounted.current && loadVersion.current === version) setLoadingDraft(false) })
  }

  const loadTimeZone = () => { setTimeZoneError(undefined); return api.workspace().then((workspace) => setTimeZone(workspace.timeZone)).catch((reason: unknown) => setTimeZoneError(reason instanceof Error ? reason.message : 'Workspace time zone could not load.')) }
  useEffect(() => { mounted.current = true; setSharing(false); setTimeZone(undefined); void load(); void loadTimeZone(); return () => { mounted.current = false; loadVersion.current++ } }, [flowId])
  const selected = useMemo(() => draft?.steps.find((step) => step.id === selectedId), [draft, selectedId])

  useLayoutEffect(() => {
    if (selected) {
      setPrompt(selected.prompt)
      setHelperText(selected.helperText ?? '')
      setRequired(selected.required)
      setNextStepId(selected.nextStepId)
      setQuestionType(selected.questionType)
      setChoices((draft?.choices ?? []).filter((choice) => choice.stepId === selected.id).map((choice) => ({ id: choice.id, value: choice.value, label: choice.label })))
      setSettingsText(selected.questionSettings ? JSON.stringify(selected.questionSettings, null, 2) : '')
    }
  }, [selected, draft?.choices, draftRead])

  const stepDirty = !!selected && (prompt !== selected.prompt || helperText !== (selected.helperText ?? '') || required !== selected.required || nextStepId !== selected.nextStepId || questionType !== selected.questionType || settingsText !== (selected.questionSettings ? JSON.stringify(selected.questionSettings, null, 2) : '') || JSON.stringify(choices) !== JSON.stringify((draft?.choices ?? []).filter((choice) => choice.stepId === selected.id).map((choice) => ({ id: choice.id, value: choice.value, label: choice.label }))))
  const dirty = stepDirty || branchDirty
  useProtectUnsavedChanges(dirty || !!deadline || !!target)
  const updateSetting = (name: string, value: string) => { const settings = settingsText ? JSON.parse(settingsText) : {}; if (value === '') delete settings[name]; else settings[name] = Number(value); setSettingsText(Object.keys(settings).length ? JSON.stringify(settings, null, 2) : '') }
  const settings = settingsText ? JSON.parse(settingsText) as Record<string, number> : {}

  const reloadAfterMutation = async (work: () => Promise<{ kind: string; step?: { id: string } }>) => {
    if (!draft) return
    setSaving(true)
    setNotice(undefined)
    try {
      const result = await work()
      if (!mounted.current) return
      if (result.kind === 'conflict') {
        setNotice({ tone: 'error', message: 'Another operator saved first. The latest draft has been reloaded.' })
      } else {
        if (result.kind === 'published') { setDeadline(''); setTarget('') }
        setNotice({ tone: 'success', message: result.kind === 'published' ? 'Published an immutable revision. New respondents use this version.' : 'Saved to the editable draft.' })
      }
      await load()
      if (result.kind === 'created' && result.step) setSelectedId(result.step.id)
    } catch (reason) {
      setNotice({ tone: 'error', message: reason instanceof ApiError && reason.details?.length ? `${reason.message} ${reason.details.map((issue) => `${draft.steps.find((step) => step.id === issue.stepId)?.prompt ?? 'Flow'}: ${issue.reason}`).join(' ')}` : reason instanceof Error ? reason.message : 'The draft operation could not be saved.' })
    } finally {
      setSaving(false)
    }
  }

  const save = () => {
    if (!selected) return
    let questionSettings: Record<string, unknown> | null = null
    try {
      questionSettings = settingsText.trim() ? JSON.parse(settingsText) as Record<string, unknown> : null
      if (!questionSettings || Array.isArray(questionSettings)) questionSettings = null
    } catch {
      setNotice({ tone: 'error', message: 'Question settings must be a JSON object.' })
      return
    }
    reloadAfterMutation(() => api.saveDraft(flowId, {
      stepId: selected.id,
      prompt,
      helperText: helperText || null,
      required,
      nextStepId,
      ...(selected.kind === 'question' ? { questionType, choices, questionSettings } : {}),
      expectedVersion: draft!.flow.draftVersion,
    }))
  }

  const addQuestion = () => reloadAfterMutation(() => api.addDraftStep(flowId, {
    expectedVersion: draft!.flow.draftVersion,
    step: {
      kind: 'question',
      questionType: 'short_text',
      prompt: 'What would you like us to know?',
      required: false,
      nextStepId: draft!.steps.find((step) => step.kind === 'completion')?.id ?? null,
    },
  }))

  const addCompletion = () => reloadAfterMutation(() => api.addDraftStep(flowId, {
    expectedVersion: draft!.flow.draftVersion,
    step: { kind: 'completion', questionType: null, prompt: 'Thank you for your feedback.' },
  }))

  const move = (direction: -1 | 1) => {
    if (!selected || !draft) return
    const index = draft.steps.findIndex((step) => step.id === selected.id)
    const destination = index + direction
    if (destination < 0 || destination >= draft.steps.length) return
    const ordered = [...draft.steps]
    ;[ordered[index], ordered[destination]] = [ordered[destination], ordered[index]]
    reloadAfterMutation(() => api.reorderDraftSteps(flowId, { expectedVersion: draft.flow.draftVersion, orderedStepIds: ordered.map((step) => step.id) }))
  }

  const publish = () => {
    if (!timeZone) { setNotice({ tone: 'error', message: 'Load workspace settings before publishing.' }); return }
    try { const deadlineAt = deadline ? zonedInstant(deadline, timeZone) : null; if (target && (!Number.isInteger(Number(target)) || Number(target) < 1)) throw new Error('Set a positive whole-number response target.'); void reloadAfterMutation(() => api.publishDraft(flowId, { expectedVersion: draft!.flow.draftVersion, deadlineAt, targetCompletedResponses: target ? Number(target) : null })) } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Check publication settings.' }) }
  }

  const changeLifecycle = async (action: 'close' | 'reopen' | 'archive') => {
    setSaving(true)
    setNotice(undefined)
    try {
      if (action === 'close') await api.closeFlow(flowId)
      if (action === 'reopen') await api.reopenFlow(flowId)
      if (action === 'archive') await api.archiveFlow(flowId)
      setNotice({ tone: 'success', message: `Flow ${action === 'archive' ? 'archived' : `${action}d`} without changing retained revisions or responses.` })
      await load()
    } catch (reason) {
      setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : 'The flow lifecycle could not be changed.' })
    } finally {
      setSaving(false)
    }
  }

  const preview = () => setPreviewing(true)

  if (!draft) return <section aria-label="Load draft"><Link className="quiet-button focus-ring" to="/app"><ArrowLeft aria-hidden="true" size={15} /> All flows</Link>{notice?.tone === 'error' ? <><p className="status-note" data-tone="error" role="alert">{notice.message}</p><button className="secondary-button focus-ring" onClick={() => { setNotice(undefined); void load() }} type="button">Retry loading draft</button></> : <p className="status-note">Loading draft…</p>}</section>
  const selectedIndex = selected ? draft.steps.findIndex((step) => step.id === selected.id) : -1

  return (
    <section aria-labelledby="builder-title">
      <header className="builder-header">
        <div>
          <Link className="muted focus-ring" style={{ fontSize: '.85rem' }} to="/app"><ArrowLeft aria-hidden="true" size={15} style={{ verticalAlign: 'middle' }} /> All flows</Link>
          <h1 id="builder-title">{draft.flow.title}</h1>
          <p className="muted" style={{ margin: '.35rem 0 0', fontSize: '.85rem' }}>Draft v{draft.flow.draftVersion}</p>
        </div>
        <div className="builder-actions">
          {draft.flow.status === 'open' || draft.flow.status === 'closed' ? <><a className="quiet-button" href={`/f/${draft.flow.slug}`} target="_blank" rel="noopener">View public flow</a><Link className="quiet-button" to="/app/flows/$flowId/results" params={{ flowId }}>Results</Link></> : null}
          <button className="quiet-button focus-ring flow-share-toggle" aria-expanded={sharing} aria-controls="flow-share-panel" onClick={() => setSharing(current => !current)} type="button">Share</button>
          <button className="quiet-button focus-ring" disabled={saving || dirty} onClick={preview} type="button"><Eye aria-hidden="true" size={16} /> Preview draft</button>
          <button className="primary-button focus-ring" disabled={saving || dirty || !timeZone || draft.flow.status === 'archived'} onClick={publish} type="button"><Send aria-hidden="true" size={16} /> Publish</button>
        </div>
      </header>
      {sharing ? <><FlowSharePanel key={draft.flow.id} flow={draft.flow} />{['open', 'closed'].includes(draft.flow.status) ? <DistributionPanel flowId={draft.flow.id} /> : null}</> : null}
      {dirty ? <p className="status-note" role="status">{stepDirty ? 'Unsaved step changes.' : 'Unsaved answer-path changes.'} Save or discard before switching steps, changing structure, previewing or publishing. <button className="quiet-button" disabled={saving} type="button" onClick={() => void load()}>Discard changes</button></p> : null}
      {notice && (notice.tone !== 'success' || !dirty) ? <p className="status-note" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}

      {!timeZone ? <p className="status-note" data-tone={timeZoneError ? 'error' : undefined} role={timeZoneError ? 'alert' : 'status'}>{timeZoneError ?? 'Loading workspace time zone…'}{timeZoneError ? <button className="quiet-button focus-ring" type="button" onClick={() => void loadTimeZone()}>Retry workspace settings</button> : null}</p> : null}
      {previewing ? <DraftPreview key={draft.flow.draftVersion} draft={draft} onClose={() => setPreviewing(false)} reloadDisabled={saving} onReload={() => {
        if (saving || (dirty && !window.confirm('Discard unsaved builder changes and reload the latest draft?'))) return
        setPreviewing(false); void load()
      }} /> : null}
      <div className="panel builder-grid">
        <aside className="builder-rail" aria-label="Flow steps">
          <p className="eyebrow">Steps</p>
          <p className="muted" style={{ margin: '.45rem 0 0', fontSize: '.88rem' }}>{draft.steps.length} steps</p>
          <div className="builder-actions" style={{ marginTop: '1rem' }}>
            <button className="quiet-button focus-ring" disabled={saving || dirty} onClick={addQuestion} type="button"><Plus aria-hidden="true" size={15} /> Question</button>
            <button className="quiet-button focus-ring" disabled={saving || dirty} onClick={addCompletion} type="button"><Plus aria-hidden="true" size={15} /> Completion</button>
          </div>
          {!draft.steps.some((step) => step.kind === 'welcome') ? <button className="quiet-button focus-ring" disabled={saving || dirty} type="button" onClick={() => reloadAfterMutation(() => api.addDraftStep(flowId, { expectedVersion: draft.flow.draftVersion, step: { kind: 'welcome', questionType: null, prompt: 'Before you begin', helperText: 'Share a few answers to help us improve.', nextStepId: draft.steps.find((step) => step.kind === 'question')?.id ?? null } }))}>Add welcome</button> : null}
          <div className="step-list">
            {draft.steps.map((step, index) => (
              <button className="step-button focus-ring" data-selected={step.id === selected?.id} key={step.id} disabled={saving || (dirty && step.id !== selectedId)} onClick={() => setSelectedId(step.id)} type="button">
                <span className="step-index">{index + 1}</span>
                <span><strong style={{ display: 'block', fontSize: '.9rem' }}>{step.prompt}</strong><small style={{ color: 'var(--subtle)', textTransform: 'capitalize' }}>{stepLabel(step)}</small></span>
              </button>
            ))}
          </div>
        </aside>

        <div className="builder-canvas">
          {selected ? <>
            <p className="eyebrow">Current draft step</p>
            <div className="preview-surface" aria-label="Draft question canvas">
              <span className="badge" data-status="draft">{stepLabel(selected)}</span>
              <h2 className="display">{prompt || 'Untitled step'}</h2>
              {helperText ? <p className="respondent-helper">{helperText}</p> : null}
            </div>
          </> : <div className="preview-surface"><p className="eyebrow">Start the flow</p><h2 className="display">Add a question and a named completion screen.</h2><p className="respondent-helper">Then connect the question to its next screen before publishing.</p></div>}
        </div>

        <aside className="builder-inspector" aria-label="Step settings">
          {selected ? <>
            <p className="eyebrow">Content</p>
            <label className="inspector-field">Prompt<textarea aria-label="Prompt" disabled={saving || branchDirty} className="text-area" onChange={(event) => setPrompt(event.target.value)} value={prompt} /></label>
            <label className="inspector-field">Why ask this?<textarea aria-label="Why ask this?" disabled={saving || branchDirty} className="text-area" onChange={(event) => setHelperText(event.target.value)} value={helperText} /></label>
            {selected.kind === 'question' ? <label className="inspector-field">Question type<select disabled={saving || branchDirty} className="text-input" onChange={(event) => {
              const nextType = event.target.value as FlowStep['questionType']
              setQuestionType(nextType)
              setSettingsText('')
              if (!['single_choice', 'multiple_choice', 'priority'].includes(nextType ?? '')) setChoices([])
            }} value={questionType ?? ''}><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="email">Email</option><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option><option value="rating">Rating</option><option value="priority">Priority</option></select></label> : null}
            {selected.kind === 'question' && ['single_choice', 'multiple_choice', 'priority'].includes(questionType ?? '') ? <div className="choice-editor"><div className="toggle-row"><strong>Choices</strong><button disabled={saving || branchDirty} className="quiet-button focus-ring" onClick={() => setChoices((current) => [...current, { value: '', label: '' }])} type="button"><Plus aria-hidden="true" size={14} /> Choice</button></div>{choices.map((choice, index) => <div className="choice-editor-row" key={choice.id ?? `new-${index}`}><input disabled={saving || branchDirty} aria-label={`Choice ${index + 1} value`} className="text-input" onChange={(event) => setChoices((current) => current.map((entry, position) => position === index ? { ...entry, value: event.target.value } : entry))} placeholder="Stable value" value={choice.value} /><input disabled={saving || branchDirty} aria-label={`Choice ${index + 1} label`} className="text-input" onChange={(event) => setChoices((current) => current.map((entry, position) => position === index ? { ...entry, label: event.target.value } : entry))} placeholder="Visible label" value={choice.label} /><button disabled={saving || branchDirty} className="quiet-button focus-ring" onClick={() => setChoices((current) => current.filter((_, position) => position !== index))} type="button">Remove</button></div>)}</div> : null}
            {selected.kind === 'question' && questionType === 'rating' ? <div className="ledger-filters">{[['min', 'Lowest rating', 1], ['max', 'Highest rating', 5]].map(([key, label, fallback]) => <label className="inspector-field" key={key}>{label}<input disabled={saving || branchDirty} className="text-input" type="number" min={0} max={10} value={settings[String(key)] ?? fallback} onChange={(event) => updateSetting(String(key), event.target.value)} /></label>)}</div> : null}
            {selected.kind === 'question' && questionType === 'multiple_choice' ? <div className="ledger-filters">{[['minSelections', 'Minimum selections', 1], ['maxSelections', 'Maximum selections', choices.length]].map(([key, label, fallback]) => <label className="inspector-field" key={key}>{label}<input disabled={saving || branchDirty} className="text-input" type="number" min={0} max={choices.length} value={settings[String(key)] ?? fallback} onChange={(event) => updateSetting(String(key), event.target.value)} /></label>)}</div> : null}
            {selected.kind !== 'completion' ? <label className="inspector-field">Default next screen<select className="text-input" disabled={saving || branchDirty} onChange={(event) => setNextStepId(event.target.value || null)} value={nextStepId ?? ''}><option value="">Choose a screen</option>{draft.steps.filter((step) => step.id !== selected.id && step.kind !== 'welcome').map((step) => <option key={step.id} value={step.id}>{stepLabel(step)} · {step.prompt}</option>)}</select></label> : null}
            {selected.kind === 'question' ? <div className="toggle-row">
              <label htmlFor="step-required">Required response</label>
              <input checked={required} disabled={saving || branchDirty} id="step-required" onChange={(event) => setRequired(event.target.checked)} type="checkbox" />
            </div> : null}
            <div className="builder-actions" style={{ marginTop: '1rem' }}>
              <button className="quiet-button focus-ring" disabled={saving || dirty || selectedIndex <= 0} onClick={() => move(-1)} type="button"><ArrowUp aria-hidden="true" size={15} /> Move</button>
              <button className="quiet-button focus-ring" disabled={saving || dirty || selectedIndex === draft.steps.length - 1} onClick={() => move(1)} type="button"><ArrowDown aria-hidden="true" size={15} /> Move</button>
              <button className="quiet-button focus-ring" disabled={saving || dirty} onClick={() => reloadAfterMutation(() => api.duplicateDraftStep(flowId, selected.id, draft.flow.draftVersion))} type="button"><Copy aria-hidden="true" size={15} /> Duplicate</button>
              <button className="quiet-button focus-ring" disabled={saving || dirty} onClick={() => reloadAfterMutation(() => api.deleteDraftStep(flowId, selected.id, draft.flow.draftVersion))} type="button"><Trash2 aria-hidden="true" size={15} /> Delete</button>
            </div>
            <div className="builder-actions" style={{ marginTop: '1rem' }}>
              <button className="primary-button focus-ring" disabled={saving || branchDirty} onClick={save} type="button"><Save aria-hidden="true" size={16} /> {saving ? 'Saving…' : 'Save step'}</button>
            </div>
            {!stepDirty ? <BranchEditor key={`${selected.id}:${draftRead}`} disabled={savingDraft || loadingDraft} onSavingChange={setBranchSaving} draft={draft} step={selected} onSaved={load} onDirty={setBranchDirty} onError={(message) => setNotice({ tone: 'error', message })} /> : <p className="muted">Save step changes before editing answer paths.</p>}

          </> : <p className="status-note">Select or add a step to edit it.</p>}
        </aside>
      </div>
      <section className="quiet-panel" style={{ padding: '1rem', marginTop: '1rem' }} aria-label="Publication limits"><h2>Next publication</h2><p className="muted">Optional limits for the next publication. Deadlines use {timeZone ?? 'the workspace time zone'} and retain that zone if settings change.</p><div className="ledger-filters"><label className="inspector-field">Close at ({timeZone ?? 'loading'})<input disabled={saving || !timeZone} className="text-input" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><label className="inspector-field">Completed response target<input disabled={saving} className="text-input" type="number" min={1} step={1} placeholder="No target" value={target} onChange={(event) => setTarget(event.target.value)} /></label></div></section>
      <footer className="builder-lifecycle" aria-label="Flow lifecycle">
        <div><p className="eyebrow">Flow lifecycle</p><strong>{draft.flow.status}</strong><p>Publishing keeps this editable draft and opens a pinned revision for new respondents.</p></div>
        <div className="builder-actions">
          {draft.flow.status === 'open' ? <button className="quiet-button focus-ring" disabled={saving || dirty} onClick={() => changeLifecycle('close')} type="button">Close responses</button> : null}
          {draft.flow.status === 'closed' ? <button className="quiet-button focus-ring" disabled={saving || dirty} onClick={() => changeLifecycle('reopen')} type="button">Reopen current revision</button> : null}
          {draft.flow.status !== 'archived' ? <button className="quiet-button focus-ring" disabled={saving || dirty} onClick={() => changeLifecycle('archive')} type="button">Archive flow</button> : null}
        </div>
      </footer>
    </section>
  )
}
