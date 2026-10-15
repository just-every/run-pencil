import { DraftRewritePanel } from '../../analysis'
import { TypeSettings } from './TypeSettings'
import { stepRules, type AuthoringDraft, type EditableChoice, type EditableRule } from '../authoring'
import { StepCanvas } from './StepCanvas'
import { ChoiceEditor } from './ChoiceEditor'
import { DistributionPanel } from '../../distribution'
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, Plus, Save, Send, Trash2 } from 'lucide-react'
import { Link, useParams, useRouter } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { timeZoneName, zonedInstant } from '../../../shared/timeZone'
import { BranchEditor } from './BranchEditor'
import { DraftPreview } from './DraftPreview'
import { FlowSharePanel } from './FlowSharePanel'
import { api, ApiError, type FlowStep } from '../../../app/api'
import { AppNote } from '../../../app/ui/AppNote'
import { LoadProblem } from '../../../app/ui/LoadProblem'

function stepLabel(step: FlowStep) {
  if (step.kind === 'welcome') return 'Welcome'
  if (step.kind === 'completion') return 'Completion'
  const label = step.questionType?.replace('_', ' ') ?? 'Question'
  return label[0].toUpperCase() + label.slice(1)
}

export function FlowBuilderPage() {
  const router = useRouter()
  const { flowId } = useParams({ from: '/app/flows/$flowId/builder' })
  const [draft, setDraft] = useState<AuthoringDraft>()
  const [draftRead, setDraftRead] = useState(0)
  const [selectedId, setSelectedId] = useState<string>()
  const [prompt, setPrompt] = useState('')
  const [helperText, setHelperText] = useState('')
  const [nextStepId, setNextStepId] = useState<string | null>(null)
  const [required, setRequired] = useState(false)
  const [questionType, setQuestionType] = useState<FlowStep['questionType']>(null)
  const [choices, setChoices] = useState<EditableChoice[]>([])
  const [settingsText, setSettingsText] = useState('')
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string }>()
  const [savingDraft, setSaving] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const saving = savingDraft || loadingDraft
  const mounted = useRef(true)
  const loadVersion = useRef(0)
  const [rules, setRules] = useState<EditableRule[]>([])
  const [canvasAnswer, setCanvasAnswer] = useState<unknown>()
  const [previewing, setPreviewing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [timeZone, setTimeZone] = useState<string>()
  const [timeZoneError, setTimeZoneError] = useState<string>()
  const [deadline, setDeadline] = useState('')
  const [target, setTarget] = useState('')
  const publicationZone = useMemo(() => {
    if (!timeZone) return { name: 'the workspace time zone', error: undefined }
    try { return { name: timeZoneName(timeZone, deadline), error: undefined } }
    catch (error) { return { name: timeZoneName(timeZone), error: error instanceof Error ? error.message : 'Choose a valid deadline.' } }
  }, [timeZone, deadline])

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
      setCanvasAnswer(undefined)
      setRules(stepRules(draft!, selected.id))
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
  const branchDirty = !!selected && JSON.stringify(rules.map((rule, position) => ({ ...rule, position }))) !== JSON.stringify(stepRules(draft!, selected.id))
  const dirty = stepDirty || branchDirty
  useProtectUnsavedChanges(dirty || !!deadline || !!target)
  const updateSetting = (name: string, value: string) => { const settings = settingsText ? JSON.parse(settingsText) : {}; if (value === '') delete settings[name]; else settings[name] = Number(value); setSettingsText(Object.keys(settings).length ? JSON.stringify(settings, null, 2) : '') }
  const settings = settingsText ? JSON.parse(settingsText) as Record<string, string | number> : {}

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
        if (result.kind === 'published') { setDeadline(''); setTarget(''); setSharing(true) }
        setNotice({ tone: 'success', message: result.kind === 'published' ? 'Published. New visitors see this version.' : 'Saved.' })
      }
      await load()
      router.clearCache({ filter: match => match.routeId === '/app/' })
      if (!mounted.current) return
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
    const input = {
      stepId: selected.id,
      prompt,
      helperText: helperText || null,
      required,
      nextStepId,
      ...(selected.kind === 'question' ? { questionType, choices, questionSettings } : {}),
      expectedVersion: draft!.flow.draftVersion,
      rules: [...draft!.branchRules.filter(rule => rule.sourceStepId !== selected.id), ...rules.map((rule, position) => ({ ...rule, position }))],
    }
    void reloadAfterMutation(() => api.saveDraft(flowId, input))
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
      setNotice({ tone: 'success', message: `Flow ${action === 'archive' ? 'archived' : action === 'close' ? 'closed' : 'reopened'}. Existing responses are kept.` })
      await load()
      router.clearCache({ filter: match => match.routeId === '/app/' })
    } catch (reason) {
      setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : 'The flow lifecycle could not be changed.' })
    } finally {
      setSaving(false)
    }
  }

  const preview = () => setPreviewing(true)

  if (!draft) return <section aria-label="Load draft">{notice?.tone === 'error' ? <LoadProblem message={notice.message} retryLabel="Retry loading draft" onRetry={() => { setNotice(undefined); void load() }} /> : <><Link className="quiet-button focus-ring" to="/app"><ArrowLeft aria-hidden="true" size={15} /> All flows</Link><p className="status-note">Loading draft…</p></>}</section>
  const selectedIndex = selected ? draft.steps.findIndex((step) => step.id === selected.id) : -1

  return (
    <section className="flow-authoring" aria-labelledby="builder-title">
      <header className="builder-header">
        <div>
          <Link className="builder-back focus-ring" to="/app"><ArrowLeft aria-hidden="true" size={16} /> All flows</Link>
          <h1 id="builder-title" className="display">{draft.flow.title}</h1>
          <p className="builder-status"><span className="badge" data-status={draft.flow.status}>{draft.flow.status[0].toUpperCase() + draft.flow.status.slice(1)}</span>{draft.flow.hasUnpublishedChanges ? <span> · Unpublished changes</span> : null}</p>
        </div>
        <div className="builder-actions">
          {draft.flow.status === 'open' || draft.flow.status === 'closed' ? <><a className="secondary-button focus-ring" href={`/f/${draft.flow.slug}`} target="_blank" rel="noopener">View public flow</a><Link className="secondary-button focus-ring" to="/app/flows/$flowId/results" params={{ flowId }}>Results</Link></> : null}
          <button className="secondary-button focus-ring flow-share-toggle" aria-expanded={sharing} aria-controls="flow-share-panel" onClick={() => setSharing(current => !current)} type="button">{sharing ? 'Edit steps' : 'Share'}</button>
          <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={preview} type="button"><Eye aria-hidden="true" size={16} /> Preview draft</button>
          <button className="primary-button focus-ring" disabled={saving || dirty || !timeZone || draft.flow.status === 'archived'} onClick={publish} type="button"><Send aria-hidden="true" size={16} /> Publish</button>
        </div>
      </header>
      {notice && (notice.tone !== 'success' || !dirty) ? <p className="status-note" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
      {sharing ? <><FlowSharePanel key={draft.flow.id} flow={draft.flow} />{['open', 'closed'].includes(draft.flow.status) ? <DistributionPanel flowId={draft.flow.id} /> : null}</> : null}
      {dirty ? <p className="status-note" role="status">{stepDirty ? 'Unsaved step changes.' : 'Unsaved answer-path changes.'} Save or discard before switching steps, changing structure, previewing or publishing. <button className="quiet-button" disabled={saving} type="button" onClick={() => void load()}>Discard changes</button></p> : null}

      {!timeZone ? <p className="status-note" data-tone={timeZoneError ? 'error' : undefined} role={timeZoneError ? 'alert' : 'status'}>{timeZoneError ?? 'Loading workspace time zone…'}{timeZoneError ? <button className="quiet-button focus-ring" type="button" onClick={() => void loadTimeZone()}>Retry workspace settings</button> : null}</p> : null}
      {previewing ? <DraftPreview key={draft.flow.draftVersion} draft={draft} onClose={() => setPreviewing(false)} reloadDisabled={saving} onReload={() => {
        if (saving || (dirty && !window.confirm('Discard unsaved builder changes and reload the latest draft?'))) return
        setPreviewing(false); void load()
      }} /> : null}
      <div className="builder-grid" hidden={sharing}>
        <aside className="builder-rail" aria-label="Flow steps">
          <p className="eyebrow">Steps</p>
          <p className="display builder-count">{draft.steps.length} steps</p>
          {!draft.steps.length ? <p className="muted builder-start-guidance">Start with a question, then add a completion screen.</p> : null}
          <div className="builder-add">
            <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={addQuestion} type="button"><Plus aria-hidden="true" size={15} /> Add question</button>
            <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={addCompletion} type="button"><Plus aria-hidden="true" size={15} /> Add completion screen</button>
          {!draft.steps.some((step) => step.kind === 'welcome') ? <button className="secondary-button focus-ring" disabled={saving || dirty} type="button" onClick={() => reloadAfterMutation(() => api.addDraftStep(flowId, { expectedVersion: draft.flow.draftVersion, step: { kind: 'welcome', questionType: null, prompt: 'Before you begin', helperText: 'Share a few answers to help us improve.', nextStepId: draft.steps.find((step) => step.kind === 'question')?.id ?? null } }))}><Plus aria-hidden="true" size={15} /> Add welcome screen</button> : null}
          </div>
          <div className="step-list">
            {draft.steps.map((step, index) => (
              <button className="step-button focus-ring" data-selected={step.id === selected?.id} key={step.id} disabled={saving || (dirty && step.id !== selectedId)} onClick={() => setSelectedId(step.id)} type="button">
                <span className="step-index">{index + 1}</span>
                <span><strong className="step-prompt">{step.prompt}</strong><small className="step-type">{stepLabel(step)}</small></span>
              </button>
            ))}
          </div>
        </aside>

        <div className="builder-canvas">
          {selected ? <>
            <p className="eyebrow">Current draft step</p>
            <AppNote className="builder-note">what they will see</AppNote>
            <div className="preview-surface" aria-label="Draft question canvas">
              <div className="canvas-step-label"><span className="canvas-chip">{stepLabel(selected)}</span>{selected.kind === 'question' && required ? <span className="canvas-chip canvas-required">Required</span> : null}</div>
              <h2 className="display">{prompt || 'Untitled step'}</h2>
              {helperText ? <p className="respondent-helper">{helperText}</p> : null}
              {selected.kind === 'question' ? <StepCanvas key={`${draftRead}-${selected.id}-${questionType}`} step={{ ...selected, prompt, required, questionType, questionSettings: settings }} choices={choices} value={canvasAnswer} onChange={setCanvasAnswer} /> : null}
            </div>
          </> : <div className="preview-surface"><p className="eyebrow">Start the flow</p><h2 className="display">Add a question and a named completion screen.</h2><p className="respondent-helper">Then connect the question to its next screen before publishing.</p></div>}
        </div>

        <aside className="builder-inspector" aria-label="Step settings">
          {selected ? <>
            <p className="eyebrow">Content</p>
            <label className="inspector-field">Prompt<textarea aria-label="Prompt" disabled={saving} className="text-area" onChange={(event) => setPrompt(event.target.value)} value={prompt} /></label>
            {selected.kind === 'question' ? <DraftRewritePanel key={`${flowId}:${selected.id}`} flowId={flowId} stepId={selected.id} version={draft.flow.draftVersion} source={selected.prompt} disabled={saving || dirty} onAccepted={load} onBusy={setSaving} /> : null}
            <details><summary className="focus-ring">Extra wording</summary><label className="inspector-field">Why ask this?<textarea aria-label="Why ask this?" disabled={saving} className="text-area" onChange={(event) => setHelperText(event.target.value)} value={helperText} /></label></details>
            {selected.kind === 'question' ? <label className="inspector-field">Question type<select disabled={saving} className="text-input" onChange={(event) => {
              const nextType = event.target.value as FlowStep['questionType']
              setQuestionType(nextType)
              setCanvasAnswer(undefined)
              setSettingsText('')
              if (!['single_choice', 'multiple_choice', 'priority', 'dropdown'].includes(nextType ?? '')) setChoices([])
              if (nextType !== questionType) { setCanvasAnswer(undefined); setRules([]) }
            }} value={questionType ?? ''}><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="email">Email</option><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option><option value="rating">Rating</option><option value="priority">Priority</option><option value="dropdown">Dropdown</option><option value="yes_no">Yes / No</option><option value="nps">NPS</option><option value="number">Number</option><option value="date">Date</option><option value="consent">Consent</option></select></label> : null}
            {selected.kind === 'question' && ['single_choice', 'multiple_choice', 'priority', 'dropdown'].includes(questionType ?? '') ? <ChoiceEditor disabled={saving} choices={choices} onChange={setChoices} /> : null}
            <TypeSettings type={questionType} settings={settings} disabled={saving} onChange={(key, value) => { const next: Record<string, unknown> = { ...settings }; if (value === undefined) delete next[key]; else next[key] = value; setSettingsText(Object.keys(next).length ? JSON.stringify(next, null, 2) : '') }} />
            {selected.kind === 'question' && questionType === 'rating' ? <div className="ledger-filters">{[['min', 'Lowest rating', 1], ['max', 'Highest rating', 5]].map(([key, label, fallback]) => <label className="inspector-field" key={key}>{label}<input disabled={saving} className="text-input" type="number" min={0} max={10} value={settings[String(key)] ?? fallback} onChange={(event) => updateSetting(String(key), event.target.value)} /></label>)}</div> : null}
            {selected.kind === 'question' && questionType === 'multiple_choice' ? <div className="ledger-filters">{[['minSelections', 'Minimum selections', 1], ['maxSelections', 'Maximum selections', choices.length]].map(([key, label, fallback]) => <label className="inspector-field" key={key}>{label}<input disabled={saving} className="text-input" type="number" min={0} max={choices.length} value={settings[String(key)] ?? fallback} onChange={(event) => updateSetting(String(key), event.target.value)} /></label>)}</div> : null}
            {selected.kind !== 'completion' ? <label className="inspector-field">Default next screen<select className="text-input" disabled={saving} onChange={(event) => setNextStepId(event.target.value || null)} value={nextStepId ?? ''}><option value="">Choose a screen</option>{draft.steps.filter((step) => step.id !== selected.id && step.kind !== 'welcome').map((step) => <option key={step.id} value={step.id}>{stepLabel(step)} · {step.prompt}</option>)}</select></label> : null}
            {selected.kind === 'question' ? <div className="toggle-row">
              <label htmlFor="step-required">Required response</label>
              <input checked={required} disabled={saving} id="step-required" onChange={(event) => setRequired(event.target.checked)} type="checkbox" />
            </div> : null}
            <div className="builder-actions builder-step-tools">
              <button className="secondary-button focus-ring" disabled={saving || dirty || selectedIndex <= 0} onClick={() => move(-1)} aria-label="Move up" title="Move up" type="button"><ArrowUp aria-hidden="true" size={15} /></button>
              <button className="secondary-button focus-ring" disabled={saving || dirty || selectedIndex === draft.steps.length - 1} onClick={() => move(1)} aria-label="Move down" title="Move down" type="button"><ArrowDown aria-hidden="true" size={15} /></button>
              <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={() => reloadAfterMutation(() => api.duplicateDraftStep(flowId, selected.id, draft.flow.draftVersion))} type="button"><Copy aria-hidden="true" size={15} /> Duplicate</button>
              <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={() => reloadAfterMutation(() => api.deleteDraftStep(flowId, selected.id, draft.flow.draftVersion))} type="button"><Trash2 aria-hidden="true" size={15} /> Delete</button>
            </div>
            <BranchEditor disabled={saving} draft={{ ...draft, choices: choices.map((choice, position) => ({ ...choice, id: choice.id ?? choice.newId!, stepId: selected.id, position })) }} step={{ ...selected, questionType }} rules={rules} onChange={setRules} />
            <div className="builder-save">
              <button className="primary-button focus-ring" disabled={saving} onClick={save} type="button"><Save aria-hidden="true" size={16} /> {saving ? 'Saving…' : 'Save'}</button>
            </div>


          </> : <p className="status-note">Select or add a step to edit it.</p>}
        </aside>
      </div>
      <details hidden={sharing} className="quiet-panel publication-options" aria-label="Publication limits"><summary className="focus-ring">Publication options</summary><p className="muted">Optional limits for the next publication. Deadlines use {publicationZone.name} and retain that zone if settings change. <Link to="/app/settings">Change time zone in Settings</Link>.</p>{publicationZone.error ? <p role="alert">{publicationZone.error}</p> : null}<div className="ledger-filters"><label className="inspector-field">Close at{timeZone ? ` (${publicationZone.name})` : ''}<input disabled={saving || !timeZone} className="text-input" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><label className="inspector-field">Completed response target<input disabled={saving} className="text-input" type="number" min={1} step={1} placeholder="No target" value={target} onChange={(event) => setTarget(event.target.value)} /></label></div></details>
      <footer className="builder-lifecycle" aria-label="Flow lifecycle">
        <div className="builder-lifecycle-status"><p className="eyebrow">Flow lifecycle</p><span className="badge" data-status={draft.flow.status}>{draft.flow.status[0].toUpperCase() + draft.flow.status.slice(1)}</span><p>Publish your saved changes when you are ready to share.</p></div>
        <div className="builder-actions">
          {draft.flow.status === 'open' || draft.flow.status === 'closed' ? <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={() => changeLifecycle('close')} type="button">Close responses</button> : null}
          {draft.flow.status === 'closed' ? <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={() => changeLifecycle('reopen')} type="button">Reopen current revision</button> : null}
          {draft.flow.status !== 'archived' ? <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={() => changeLifecycle('archive')} type="button">Archive flow</button> : null}
        </div>
      </footer>
    </section>
  )
}
