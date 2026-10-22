import { useEffect, useId, useState } from 'react'
import type { BuilderDraft } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'
import { hiddenSettingsIssue, type FormSettings } from '../../../shared/hiddenFields'
import { linkPreviewLimits, previewText, resolveLinkPreview } from '../../../shared/linkPreview'
import { brandApi, publicBrandConfig } from '../../brand'
import { encodeLogo, validateLogo } from '../../brand'
import './link-preview.css'

type Props = {
  draft: BuilderDraft
  publicUrl?: string
  disabled: boolean
  onDirtyChange: (dirty: boolean) => void
  onSave: (settings: FormSettings) => Promise<void>
}

export function FlowLinkPreview({ draft, publicUrl, disabled, onDirtyChange, onSave }: Props) {
  const settings = draft.formSettings ?? { hiddenFields: [], identityMode: 'anonymous' }
  const [value, setValue] = useState<NonNullable<FormSettings['linkPreview']>>(settings.linkPreview ?? {})
  const [brand, setBrand] = useState<PublicSeedConfig>()
  const [brandError, setBrandError] = useState<string>()
  const [error, setError] = useState<string>()
  const [reading, setReading] = useState(false)
  const id = useId()
  const dirty = JSON.stringify(value) !== JSON.stringify(settings.linkPreview ?? {})
  const nextSettings = { ...settings, linkPreview: value }
  const issue = hiddenSettingsIssue(nextSettings)
  const preview = resolveLinkPreview(nextSettings, draft.flow.title, draft.steps)
  const image = value.image
    ? 'key' in value.image
      ? `/api/app/flows/${encodeURIComponent(draft.flow.id)}/preview-image?key=${encodeURIComponent(value.image.key)}`
      : `data:${value.image.mime};base64,${value.image.base64}`
    : brand?.publicFlowLogoUrl
  const alt = value.image ? previewText(value.image.alt) : `${brand?.publicFlowBusinessName ?? ''} logo`
  const indexingUnavailable = !!settings.access || settings.identityMode === 'identified'

  useEffect(() => {
    onDirtyChange(dirty || reading)
    return () => onDirtyChange(false)
  }, [dirty, reading, onDirtyChange])
  useEffect(() => {
    let active = true
    void brandApi.get().then(saved => {
      if (active) setBrand(publicBrandConfig(saved, { productName: 'Pencil', organizationName: '', showPoweredByCredit: false }))
    }).catch(reason => { if (active) setBrandError(reason instanceof Error ? reason.message : 'Business branding could not load.') })
    return () => { active = false }
  }, [])

  async function upload(file: File) {
    setError(undefined); setReading(true)
    try {
      if (file.size > linkPreviewLimits.imageBytes) throw new Error(`Choose an image up to ${linkPreviewLimits.imageBytes / 1024} KB.`)
      const bytes = new Uint8Array(await file.arrayBuffer())
      validateLogo(bytes, file.type)
      setValue(current => ({ ...current, image: { mime: file.type, base64: encodeLogo(bytes), alt: current.image?.alt ?? '' } }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The image could not be read.') }
    finally { setReading(false) }
  }

  return <details className="flow-link-preview">
    <summary className="focus-ring">Link preview</summary>
    <p className="muted">Draft · publish to apply</p>
    <article className="quiet-panel flow-link-preview-card" aria-label="Link preview card">
      {image ? <div className="flow-link-preview-image" style={{ background: brand?.publicFlowTheme.background }}><img src={image} alt={alt} data-custom={!!value.image} /></div> : null}
      <div className="flow-link-preview-copy"><p className="eyebrow">{publicUrl ? new URL(publicUrl).host : 'Public form'}</p><h4>{previewText(preview.title)}</h4>{preview.description ? <p>{previewText(preview.description)}</p> : null}</div>
    </article>
    {brandError ? <p className="status-note" data-tone="error" role="alert">{brandError}</p> : null}
    <details className="flow-link-preview-settings">
      <summary className="focus-ring">Edit link preview</summary>
      <p className="muted">Choose what appears when you share this form. Save these draft changes, then publish.</p>
      <form onSubmit={event => { event.preventDefault(); if (!disabled && !reading && dirty && !issue) void onSave(nextSettings).catch(reason => setError(reason instanceof Error ? reason.message : 'The link preview could not be saved.')) }}>
        <fieldset className="plain-fieldset" disabled={disabled || reading}>
          <legend className="sr-only">Link preview settings</legend>
          <label className="inspector-field">Share title<input className="text-input" value={value.title ?? ''} placeholder={previewText(draft.flow.title)} maxLength={linkPreviewLimits.titleCharacters} onChange={event => { setError(undefined); setValue({ ...value, title: event.target.value || undefined }) }} /></label>
          <div className="inspector-field"><label htmlFor={`${id}-description`}>Share description</label><textarea id={`${id}-description`} className="text-area" rows={3} value={value.description ?? ''} placeholder={resolveLinkPreview(settings, draft.flow.title, draft.steps).description} maxLength={linkPreviewLimits.descriptionCharacters} onChange={event => { setError(undefined); setValue({ ...value, description: event.target.value }) }} /></div>
          <p className="muted">The form title and welcome text are used until you customize them. Answers and recalled values are never included.</p>
          <label className="inspector-field">Share image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} /></label>
          <p className="muted">PNG, JPEG or WebP, up to {linkPreviewLimits.imageBytes / 1024} KB. Your business logo is used by default.</p>
          {value.image ? <><label className="inspector-field">Share image alt text<input className="text-input" required maxLength={linkPreviewLimits.altCharacters} value={value.image.alt} onChange={event => { setError(undefined); setValue({ ...value, image: { ...value.image!, alt: event.target.value } }) }} /><span className="muted">Describe the image for people who cannot see it.</span></label><button className="quiet-button focus-ring" type="button" onClick={() => { setError(undefined); setValue({ ...value, image: undefined }) }}>Use business logo</button></> : null}
          <label className="toggle-row"><input type="checkbox" checked={value.allowIndexing === true} disabled={indexingUnavailable && !value.allowIndexing} onChange={event => { setError(undefined); setValue({ ...value, allowIndexing: event.target.checked }) }} /><span>Allow search engines to index this form</span></label>
          <p className="muted">Off by default. Indexing applies only to the public form address. Invitations, embeds and completion pages stay hidden from search. Restricted and identified forms cannot be indexed.</p>
          {dirty && issue ? <p className="status-note" data-tone="error" role="alert">{issue}</p> : null}
          <div className="builder-actions"><button className="secondary-button focus-ring" type="submit" disabled={!dirty || !!issue}>Save link preview</button>{dirty ? <button className="quiet-button focus-ring" type="button" onClick={() => { setValue(settings.linkPreview ?? {}); setError(undefined) }}>Discard preview changes</button> : null}</div>
        </fieldset>
        {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
      </form>
    </details>
  </details>
}
