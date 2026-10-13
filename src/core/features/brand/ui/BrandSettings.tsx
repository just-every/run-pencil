import { useEffect, useState } from 'react'
import { api, type DashboardFlow } from '../../../app/api'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { brandApi } from '../api'
import { brandStyle, publicBrandConfig, type BrandInput, type WorkspaceBrand } from '../brand'
import { BrandIdentity } from './BrandIdentity'
import { logoByteLimit } from '../logo'
import { Tag } from 'lucide-react'

export function BrandSettings() {
  const [saved, setSaved] = useState<WorkspaceBrand>()
  const [form, setForm] = useState<BrandInput>()
  const [flows, setFlows] = useState<DashboardFlow[]>([])
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const apply = (brand: WorkspaceBrand) => { setSaved(brand); setForm({ name: brand.configured ? brand.name : '', supportingLine: brand.supportingLine, accent: brand.accent, publicFlowSlug: brand.publicFlowSlug }) }
  const load = () => { setError(undefined); void Promise.all([brandApi.get(), api.dashboard()]).then(([brand, choices]) => { apply(brand); setFlows(choices) }).catch(e => setError((e as Error).message)) }
  useEffect(load, [])
  useProtectUnsavedChanges(!!saved && !!form && (form.name !== (saved.configured ? saved.name : '') || form.supportingLine !== saved.supportingLine || form.accent !== saved.accent || form.publicFlowSlug !== saved.publicFlowSlug))
  const perform = async (action: () => Promise<WorkspaceBrand>, message: string, replaceForm: boolean) => {
    setBusy(true); setError(undefined); setNotice(undefined)
    try { const brand = await action(); if (replaceForm) apply(brand); else setSaved(brand); setNotice(message) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const preview = saved && publicBrandConfig(saved, { productName: 'Pencil', organizationName: '', showPoweredByCredit: false })
  return <section className="panel settings-card brand-settings" aria-labelledby="brand-title">
    <header className="card-title"><Tag aria-hidden="true" size={22} strokeWidth={1.75} /><h2 className="display" id="brand-title">Business branding</h2></header>
    <p className="muted">Your saved name, logo and accent appear on your forms, preview and public landing.</p>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {notice ? <p className="status-note" role="status">{notice}</p> : null}
    {!form ? <>{!error ? <p>Loading business branding…</p> : <button className="secondary-button" onClick={load}>Retry branding</button>}</> : <>
      <form onSubmit={event => { event.preventDefault(); void perform(() => brandApi.save(form), 'Business branding saved.', true) }}>
        <label className="inspector-field">Business name<input className="text-input" required maxLength={100} disabled={busy} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="inspector-field">Supporting line<input className="text-input" maxLength={240} disabled={busy} value={form.supportingLine} onChange={e => setForm({ ...form, supportingLine: e.target.value })} /></label>
        <label className="inspector-field">Accent colour<span className="accent-field"><span aria-hidden="true" className="accent-swatch" style={/^#[0-9a-f]{6}$/i.test(form.accent) ? { background: form.accent } : undefined} /><input className="text-input" pattern="#[0-9a-fA-F]{6}" maxLength={7} required disabled={busy} value={form.accent} onChange={e => setForm({ ...form, accent: e.target.value })} /></span></label>
        <p className="muted settings-help">Use #rrggbb. Button text automatically uses black or white for readable contrast.</p>
        <label className="inspector-field">Public landing flow<select className="text-input" disabled={busy} value={form.publicFlowSlug ?? ''} onChange={e => setForm({ ...form, publicFlowSlug: e.target.value || null })}><option value="">No public landing</option>{flows.filter(flow => flow.status === 'open' || flow.slug === saved?.publicFlowSlug).map(flow => <option key={flow.slug} value={flow.slug}>{flow.title}{flow.status !== 'open' ? ' (closed)' : ''}</option>)}{saved?.publicFlowSlug && !flows.some(flow => flow.slug === saved.publicFlowSlug) ? <option value={saved.publicFlowSlug}>Selected flow is unavailable</option> : null}</select></label>
        <button className="primary-button focus-ring settings-save" disabled={busy} type="submit">Save business branding</button>
      </form>
      <label className="inspector-field">Business logo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void perform(() => brandApi.upload(file), 'Business logo saved.', false) }} /></label>
      <p className="muted settings-help">PNG, JPEG or WebP, up to {logoByteLimit / 1024} KB. SVG is not accepted.</p>
      {saved?.logoVersion ? <button className="quiet-button focus-ring" type="button" disabled={busy} onClick={() => void perform(brandApi.removeLogo, 'Business logo removed.', false)}>Remove business logo</button> : null}
      {preview ? <div className="brand-surface brand-saved-preview" style={brandStyle(preview)} aria-label="Saved business branding"><BrandIdentity config={preview} /><button className="primary-button" type="button" tabIndex={-1}>Button preview</button></div> : null}
    </>}
  </section>
}
