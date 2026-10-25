import { ChatFormSettings } from '../../chat-integrations/ui'
import { ResponseEditSettings } from './ResponseEditSettings'
import { AnswerAlertSettings } from '../../notifications/ui'
import { SheetSettings } from '../../google-sheets/ui'
import { AddressSettings } from '../../addresses/ui'
import { ConfirmationSettings } from './ConfirmationSettings'
import { RespondentTextSettings } from './RespondentTextSettings'
import { MarketingOptInSettings } from './MarketingOptInSettings'
import { Tooltip } from '../../../shared/ui/Tooltip'
import { PrefillSettings } from './PrefillSettings'
import { RetentionPanel } from '../../retention'
import { PaymentStepSettings } from '../../payments/ui'
import { formatUsd, type PaymentSettings } from '../../../shared/payments'
import { CreditCard } from 'lucide-react'
import { randomizableChoices } from '../../../shared/presentationOrder'
import { CompletionSettings } from './CompletionSettings'
import { RedirectOriginsSettings } from './RedirectOriginsSettings'
import { CalculationSettings } from './CalculationSettings'
import { AccessSettings } from '../../restricted-access/ui'
import { HiddenFieldsSettings } from './HiddenFieldsSettings'
import { ScreenSettings } from './ScreenSettings'
import { SaveTeamTemplate } from './SaveTeamTemplate'
import { RecallHelp } from './RecallHelp'
import { SpecialChoicesEditor } from './SpecialChoicesEditor'
import { CollectorsPanel } from '../../collectors'
import { questionTypes, questionTypeLabels } from '../../../shared/questionKinds'
import { RatingSettings } from './RatingSettings'
import { DraftRewritePanel } from '../../analysis/ui'
import { TypeSettings } from './TypeSettings'
import { stepRules, type AuthoringDraft, type EditableChoice, type EditableRule } from '../authoring'
import { StepCanvas } from './StepCanvas'
import { ChoiceEditor } from './ChoiceEditor'
import { DistributionPanel } from '../../distribution'
import { ArrowDown, ArrowLeft, ArrowUp, GitBranch, Copy, Eye, Plus, Save, Send, Trash2 } from 'lucide-react'
import { Link, useParams, useRouter } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { timeZoneName, zonedInstant } from '../../../shared/timeZone'
import { BranchEditor, supportsAnswerPaths } from './BranchEditor'
import { DraftPreview } from './DraftPreview'
import { FlowSharePanel } from './FlowSharePanel'
import { api, ApiError, type FlowStep } from '../../../app/api'
import { AppNote } from '../../../app/ui/AppNote'
import { LoadProblem } from '../../../app/ui/LoadProblem'

function stepLabel(step: FlowStep) {
  if (step.kind === 'welcome') return 'Welcome'
  if (step.kind === 'completion') return 'Completion'
  if (step.kind === 'payment') return 'Payment'
  return step.questionType ? questionTypeLabels[step.questionType] : 'Question'
}

export function FlowBuilderPage() {
  const router = useRouter()
  const { flowId } = useParams({ from: '/app/flows/$flowId/builder' })
  const [draft, setDraft] = useState<AuthoringDraft>()
  const [shareDirty, setShareDirty] = useState(false)
  const [chatDirty,setChatDirty]=useState(false)
  const [alertsDirty,setAlertsDirty]=useState(false)
  const [panelDiscard,setPanelDiscard]=useState(0)
  const [redirectDirty,setRedirectDirty]=useState(false)
  const [calculationDirty,setCalculationDirty]=useState(false)
  const [settingsDirty,setSettingsDirty]=useState(false)
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
  const [showAnswerPaths, setShowAnswerPaths] = useState(false)
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
      setShowAnswerPaths(false)
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
  const dirty = stepDirty || branchDirty || settingsDirty || calculationDirty || redirectDirty || shareDirty || chatDirty || alertsDirty
  useProtectUnsavedChanges(dirty || !!deadline || !!target)
  const updateSetting = (name: string, value: string) => { const settings = settingsText ? JSON.parse(settingsText) : {}; if (value === '') delete settings[name]; else settings[name] = Number(value); setSettingsText(Object.keys(settings).length ? JSON.stringify(settings, null, 2) : '') }
  const settings = settingsText ? JSON.parse(settingsText) as Record<string, unknown> : {}

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
      questionSettings,
      ...(selected.kind === 'question' ? { questionType, choices } : {}),
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

  // PAY-001: a payment step sits after the questions that set its amount and leads straight to a completion screen.
  const addPayment = () => reloadAfterMutation(() => api.addDraftStep(flowId, {
    expectedVersion: draft!.flow.draftVersion,
    step: { kind: 'payment', questionType: null, prompt: 'Pay for your order', nextStepId: draft!.steps.find((step) => step.kind === 'completion')?.id ?? null },
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
          <button className="secondary-button focus-ring flow-share-toggle" disabled={saving || shareDirty} aria-expanded={sharing} aria-controls="flow-share-panel" onClick={() => setSharing(current => !current)} type="button">{sharing ? 'Edit steps' : 'Share'}</button>
          <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={preview} type="button"><Eye aria-hidden="true" size={16} /> Preview draft</button>
          <button className="primary-button focus-ring" disabled={saving || dirty || !timeZone || draft.flow.status === 'archived'} onClick={publish} type="button"><Send aria-hidden="true" size={16} /> Publish</button>
        </div>
      </header>
      {notice && (notice.tone !== 'success' || !dirty) ? <p className="status-note" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
      {sharing ? <><FlowSharePanel key={`share-${draftRead}`} draft={draft} disabled={saving || stepDirty || branchDirty || settingsDirty || calculationDirty || redirectDirty || chatDirty || alertsDirty || draft.flow.status === 'archived'} onDirtyChange={setShareDirty} onSave={async settings => { setSaving(true); try { const result = await api.saveFormSettings(flowId, settings, draft.flow.draftVersion); if (result.kind === 'conflict') throw new Error('Another operator saved first. Reload before saving the link preview.'); await load(); setNotice({ tone: 'success', message: 'Link preview saved to the draft. Publish to apply it.' }) } finally { setSaving(false) } }} /><details className="retention-settings"><summary className="focus-ring">Retention and legal hold</summary><RetentionPanel key={`retention-${draft.flow.id}`} flowId={flowId} /></details><AccessSettings key={`access-${draft.flow.id}`} draft={draft} disabled={saving||stepDirty||branchDirty||settingsDirty||calculationDirty||redirectDirty||shareDirty||chatDirty||alertsDirty||draft.flow.status==='archived'} onSaved={load}/>{['open', 'closed'].includes(draft.flow.status) ? <>{timeZone ? <details className="named-collectors-disclosure"><summary>Manage named collectors</summary><CollectorsPanel flowId={draft.flow.id} timeZone={timeZone} /></details> : null}<DistributionPanel flowId={draft.flow.id} /></> : null}</> : null}
      {dirty ? <p className="status-note" role="status">{chatDirty ? 'Unsaved chat changes.' : alertsDirty ? 'Unsaved alert changes.' : shareDirty ? 'Unsaved link-preview changes.' : calculationDirty ? 'Unsaved calculation changes.' : settingsDirty ? 'Unsaved hidden-field changes.' : stepDirty ? 'Unsaved step changes.' : 'Unsaved answer-path changes.'} Save or discard before switching steps, changing structure, previewing or publishing. <button className="quiet-button" disabled={saving} type="button" onClick={() => { setPanelDiscard(value=>value+1); void load() }}>Discard changes</button></p> : null}

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
            {/* After the completion button: on a phone it shares the second row with Add welcome screen instead of adding a row. */}
            <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={addPayment} type="button"><CreditCard aria-hidden="true" size={15} /> Add payment step</button>
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
              {selected.kind === 'payment' ? <p className="payment-note">{(() => { const pricing = settings.payment as PaymentSettings | undefined; if (!pricing) return 'Choose how this step prices the order. Respondents see their total, then pay on Stripe Checkout.'; const calculation = draft.formSettings?.calculations?.find(value => value.id === pricing.calculationId); return `${calculation ? `Charges the calculation “${calculation.name}”` : `Charges ${pricing.products.length} product${pricing.products.length === 1 ? '' : 's'} and ${pricing.options.length} option price${pricing.options.length === 1 ? '' : 's'}`}, between ${formatUsd(pricing.minimum)} and ${formatUsd(pricing.maximum)}, on Stripe Checkout.` })()}</p> : null}
            </div>
          </> : <div className="preview-surface"><p className="eyebrow">Start the flow</p><h2 className="display">Add a question and a named completion screen.</h2><p className="respondent-helper">Then connect the question to its next screen before publishing.</p></div>}
        </div>

        <aside className="builder-inspector" aria-label="Step settings">
          {selected ? <>
            <div className="eyebrow step-content-heading"><span>Content</span>{selected.kind === 'question' ? <PrefillSettings key={`prefill-${draftRead}-${selected.id}`} draft={draft} stepId={selected.id} disabled={saving||dirty} onSave={async prefill=>{setNotice(undefined);const result=await api.saveFormSettings(flowId,{...draft.formSettings!,prefill},draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload the draft.');await load();setNotice({tone:'success',message:'Prefill mapping saved to the draft. Publish to apply it.'})}}/> : null}{selected.kind === 'question' ? <ScreenSettings allowGroups key={`${draftRead}-${selected.id}`} draft={draft} selected={{...selected,questionSettings:settings}} disabled={saving} saveDisabled={dirty} onSave={layout=>void reloadAfterMutation(()=>api.saveScreen(flowId,{stepId:selected.id,expectedVersion:draft.flow.draftVersion,layout}))} onVisibility={condition=>{const next:Record<string,unknown>={...settings};if(condition)next.showWhen=condition;else delete next.showWhen;setSettingsText(JSON.stringify(next,null,2))}}/> : null}</div>
            <label className="inspector-field">Prompt<textarea aria-label="Prompt" disabled={saving} className="text-area" onChange={(event) => setPrompt(event.target.value)} value={prompt} /></label>
            {selected.kind === 'question' ? <DraftRewritePanel key={`${flowId}:${selected.id}`} flowId={flowId} stepId={selected.id} version={draft.flow.draftVersion} source={selected.prompt} disabled={saving || dirty} onAccepted={load} onBusy={setSaving} /> : null}
            <RecallHelp flow={draft} currentStepId={selected.id} disabled={saving} onInsert={reference => setPrompt(current => current + (current && !/\s$/.test(current) ? ' ' : '') + reference)} />
            <details><summary className="focus-ring">Extra wording</summary><label className="inspector-field">Why ask this?<textarea aria-label="Why ask this?" disabled={saving} className="text-area" onChange={(event) => setHelperText(event.target.value)} value={helperText} /></label></details>
            {selected.kind === 'question' ? <label className="inspector-field">Question type<select aria-label="Question type" disabled={saving} className="text-input" onChange={(event) => {
              const nextType = event.target.value as FlowStep['questionType']
              setQuestionType(nextType)
              setCanvasAnswer(undefined)
              setSettingsText('')
              if (!['single_choice', 'multiple_choice', 'priority', 'dropdown'].includes(nextType ?? '')) setChoices([])
              if (nextType !== questionType) { setCanvasAnswer(undefined); setRules([]) }
            }} value={questionType ?? ''}>{questionTypes.map(type => <option value={type} key={type}>{questionTypeLabels[type]}</option>)}</select></label> : null}
            {selected.kind === 'question' && ['single_choice', 'multiple_choice', 'priority', 'dropdown'].includes(questionType ?? '') ? <ChoiceEditor key={selected.id} disabled={saving} choices={choices} onChange={setChoices} /> : null}
            <SpecialChoicesEditor type={questionType} choices={choices} settings={settings} disabled={saving} onChoices={setChoices} onSettings={next => setSettingsText(JSON.stringify(next, null, 2))} />
            {selected.kind === 'payment' ? <PaymentStepSettings key={`${draftRead}-${selected.id}`} draft={draft} step={selected} value={settings.payment} disabled={saving} onChange={payment => setSettingsText(JSON.stringify({ ...settings, payment }, null, 2))} /> : null}
            {selected.kind==='completion'?<CompletionSettings draft={draft} stepId={selected.id} value={settings.redirect} disabled={saving} onChange={redirect=>{const next={...settings};if(redirect)next.redirect=redirect;else delete next.redirect;setSettingsText(JSON.stringify(next,null,2))}}/>:null}
            {selected.kind==='completion'?<MarketingOptInSettings key={`marketing-${draftRead}-${selected.id}`} draft={draft} disabled={saving||dirty} onSave={async marketing=>{setNotice(undefined);const next={...draft.formSettings!};if(marketing)next.marketing=marketing;else delete next.marketing;const result=await api.saveFormSettings(flowId,next,draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload the draft.');await load();setNotice({tone:'success',message:'Marketing opt-in saved to the draft. Publish to apply it.'})}}/>:null}
            {selected.kind==='completion'?<SheetSettings key={`sheets-${draftRead}`} flowId={flowId} disclosed={draft.formSettings?.googleSheets===true} onDisclosure={async googleSheets=>{const result=await api.saveFormSettings(flowId,{...draft.formSettings!,googleSheets},draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload the draft.');await load()}}/>:null}
            {selected.kind==='completion'?<AddressSettings key={draft.flow.slug} flowId={flowId} slug={draft.flow.slug} onRenamed={load}/>:null}
            {selected.kind==='completion'?<RespondentTextSettings key={`respondent-text-${draftRead}-${selected.id}`} draft={draft} disabled={saving||dirty} onSave={async text=>{setNotice(undefined);const next={...draft.formSettings!};if(Object.keys(text).length)next.text=text;else delete next.text;const result=await api.saveFormSettings(flowId,next,draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload the draft.');await load();setNotice({tone:'success',message:'Respondent text saved to the draft. Publish to apply it.'})}}/>:null}
            {selected.kind==='completion'?<ChatFormSettings key={`chat-${flowId}`} draft={draft} discardVersion={panelDiscard} onDirtyChange={setChatDirty} disabled={saving||stepDirty||branchDirty||settingsDirty||calculationDirty||redirectDirty||shareDirty||alertsDirty}/>:null}
            {selected.kind==='completion'?<ResponseEditSettings key={`edits-${draftRead}`} value={draft.formSettings?.responseEdits} disabled={saving||dirty} onSave={async responseEdits=>{const result=await api.saveFormSettings(flowId,{...draft.formSettings!,responseEdits},draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload the draft.');await load();setNotice({tone:'success',message:'Editing settings saved. Publish to apply.'})}}/>:null}
            {selected.kind==='completion'?<AnswerAlertSettings key={`alerts-${flowId}`} draft={draft} discardVersion={panelDiscard} onDirtyChange={setAlertsDirty} disabled={saving||stepDirty||branchDirty||settingsDirty||calculationDirty||redirectDirty||shareDirty||chatDirty} onSave={async (answerAlerts,retry)=>{
              const current=retry?await api.builder(flowId):draft
              const result=await api.saveFormSettings(flowId,{...current.formSettings!,answerAlerts},current.flow.draftVersion)
              if(result.kind==='conflict')return 'conflict'
              const next=await api.builder(flowId)
              if(mounted.current)setDraft(next)
              return 'saved'
            }}/>:null}
            {selected.kind==='completion'?<ConfirmationSettings key={`confirmation-${draftRead}-${selected.id}`} draft={draft} stepId={selected.id} disabled={saving||dirty} onSave={async confirmation=>{setNotice(undefined);const result=await api.saveFormSettings(flowId,{...draft.formSettings!,confirmation},draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload the draft.');await load();setNotice({tone:'success',message:'Confirmation settings saved to the draft. Publish to apply it.'})}}/>:null}
            <TypeSettings type={questionType} settings={settings} disabled={saving} onChange={(key, value) => { const next: Record<string, unknown> = { ...settings }; if (value === undefined) delete next[key]; else next[key] = value; setSettingsText(Object.keys(next).length ? JSON.stringify(next, null, 2) : '') }} />
            {selected.kind === 'question' && questionType === 'rating' ? <RatingSettings settings={settings} disabled={saving} onChangeSettings={next => setSettingsText(JSON.stringify(next, null, 2))} /> : null}
            {selected.kind === 'question' && questionType === 'multiple_choice' ? <div className="ledger-filters">{[['minSelections', 'Minimum selections', 1], ['maxSelections', 'Maximum selections', choices.length]].map(([key, label, fallback]) => <label className="inspector-field" key={key}>{label}<input disabled={saving} className="text-input" type="number" min={0} max={choices.length} value={settings[String(key)] as number ?? fallback} onChange={(event) => updateSetting(String(key), event.target.value)} /></label>)}</div> : null}
            {selected.kind !== 'completion' ? <label className="inspector-field">Default next screen<select className="text-input" disabled={saving} onChange={(event) => setNextStepId(event.target.value || null)} value={nextStepId ?? ''}><option value="">Choose a screen</option>{draft.steps.filter((step) => step.id !== selected.id && step.kind !== 'welcome').map((step) => <option key={step.id} value={step.id}>{stepLabel(step)} · {step.prompt}</option>)}</select></label> : null}
            {selected.kind === 'question' ? <div className={randomizableChoices(questionType) ? 'question-options' : 'toggle-row'}>
              {randomizableChoices(questionType) ? <label className="toggle-row"><input checked={required} disabled={saving} onChange={(event) => setRequired(event.target.checked)} type="checkbox" /><span>Required response</span></label> : <><label htmlFor="step-required">Required response</label><input checked={required} disabled={saving} id="step-required" onChange={(event) => setRequired(event.target.checked)} type="checkbox" /></>}
              {randomizableChoices(questionType) ? <label className="toggle-row" title="Other and None stay last."><input type="checkbox" aria-label="Randomize choice order" aria-description="Other and None stay last." disabled={saving} checked={settings.randomizeChoices === true} onChange={event => setSettingsText(JSON.stringify({ ...settings, randomizeChoices: event.target.checked }))} /><span>Randomize choice order</span></label> : null}
            </div> : null}
            <div className="builder-actions builder-step-tools">
              <Tooltip label="Move up"><button className="secondary-button focus-ring" disabled={saving || dirty || selectedIndex <= 0} onClick={() => move(-1)} aria-label="Move up" type="button"><ArrowUp aria-hidden="true" size={15} /></button></Tooltip>
              <Tooltip label="Move down"><button className="secondary-button focus-ring" disabled={saving || dirty || selectedIndex === draft.steps.length - 1} onClick={() => move(1)} aria-label="Move down" type="button"><ArrowDown aria-hidden="true" size={15} /></button></Tooltip>
              <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={() => reloadAfterMutation(() => api.duplicateDraftStep(flowId, selected.id, draft.flow.draftVersion))} type="button"><Copy aria-hidden="true" size={15} /> Duplicate</button>
              <button className="secondary-button focus-ring" disabled={saving || dirty} onClick={() => { if (window.confirm(`Delete “${selected.prompt || stepLabel(selected)}”? Any branching rules that lead to this question will also be removed. Published responses stay unchanged.`)) void reloadAfterMutation(() => api.deleteDraftStep(flowId, selected.id, draft.flow.draftVersion)) }} type="button"><Trash2 aria-hidden="true" size={15} /> Delete</button>
              {selected.kind === 'question' && !supportsAnswerPaths(questionType) && rules.length === 0 ? <Tooltip label="Answer paths"><button className="secondary-button focus-ring builder-path-toggle" type="button" aria-label="Answer paths" aria-expanded={showAnswerPaths} disabled={saving} onClick={() => setShowAnswerPaths(value => !value)}><GitBranch aria-hidden="true" size={15}/></button></Tooltip> : null}
            </div>
            {supportsAnswerPaths(questionType) || rules.length > 0 || showAnswerPaths ? <BranchEditor disabled={saving} draft={{ ...draft, choices: [...draft.choices.filter(choice => choice.stepId !== selected.id), ...choices.map((choice, position) => ({ ...choice, id: choice.id ?? choice.newId!, stepId: selected.id, position }))] }} step={{ ...selected, questionType }} rules={rules} onChange={setRules} /> : null}
            <div className="builder-save">
              <button className="primary-button focus-ring" disabled={saving||chatDirty||alertsDirty} onClick={save} type="button"><Save aria-hidden="true" size={16} /> {saving ? 'Saving…' : 'Save'}</button>
            </div>


          </> : <p className="status-note">Select or add a step to edit it.</p>}
        </aside>
      </div>
      <details hidden={sharing} className="quiet-panel publication-options" aria-label="Publication limits"><summary className="focus-ring">Publication options</summary><p className="muted">Optional limits for the next publication. Deadlines use {publicationZone.name} and retain that zone if settings change. <Link to="/app/settings">Change time zone in Settings</Link>.</p>{publicationZone.error ? <p role="alert">{publicationZone.error}</p> : null}<div className="ledger-filters"><label className="inspector-field">Close at{timeZone ? ` (${publicationZone.name})` : ''}<input disabled={saving || !timeZone} className="text-input" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><label className="inspector-field">Completed response target<input disabled={saving} className="text-input" type="number" min={1} step={1} placeholder="No target" value={target} onChange={(event) => setTarget(event.target.value)} /></label></div>
      <div className="revision-value-settings">
      <HiddenFieldsSettings key={draftRead} settings={draft.formSettings ?? {hiddenFields:[],identityMode:'anonymous'}} onDirtyChange={setSettingsDirty} disabled={saving||stepDirty||branchDirty||calculationDirty||redirectDirty||chatDirty||alertsDirty||draft.flow.status==='archived'} onSave={async settings=>{setSaving(true);try {const result=await api.saveFormSettings(flowId,settings,draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload the draft before saving hidden fields.');await load();setNotice({tone:'success',message:'Saved.'})}finally{setSaving(false)}}} />
      {draft.steps.some(step=>step.kind==='completion'&&step.questionSettings?.redirect)?<RedirectOriginsSettings key={`redirects-${draftRead}`} origins={draft.formSettings?.redirectOrigins ?? []} onDirtyChange={setRedirectDirty} disabled={saving||stepDirty||branchDirty||settingsDirty||calculationDirty||chatDirty||alertsDirty||draft.flow.status==='archived'} onSave={async redirectOrigins=>{setSaving(true);try{const result=await api.saveFormSettings(flowId,{...draft.formSettings!,redirectOrigins},draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload before saving redirect origins.');await load();setNotice({tone:'success',message:'Saved.'})}finally{setSaving(false)}}}/>:null}
      <CalculationSettings key={`calculations-${draftRead}`} draft={draft} calculations={draft.formSettings?.calculations ?? []} onDirtyChange={setCalculationDirty} disabled={saving||stepDirty||branchDirty||settingsDirty||redirectDirty||chatDirty||alertsDirty||draft.flow.status==='archived'} onSave={async calculations=>{setSaving(true);try {const result=await api.saveFormSettings(flowId,{...draft.formSettings!,calculations},draft.flow.draftVersion);if(result.kind==='conflict')throw new Error('Another operator saved first. Reload before saving calculations.');await load();setNotice({tone:'success',message:'Saved.'})}finally{setSaving(false)}}}/>
      </div>
      <SaveTeamTemplate key={draft.flow.id} flowId={flowId} version={draft.flow.draftVersion} title={draft.flow.title} published={draft.flow.status !== 'draft'} disabled={saving||dirty} /></details>
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
