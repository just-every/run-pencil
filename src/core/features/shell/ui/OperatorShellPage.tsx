import { Tooltip } from '../../../shared/ui/Tooltip'
import { OwnerEditorShell } from '../../../../editor/owner-editor'
import { useEffect, useState } from 'react'
import { Link, Outlet, useRouterState, useNavigate } from '@tanstack/react-router'
import { BrandMark } from '../../../app/ui/BrandMark'
import type { PublicSeedConfig } from '../../../shared/config'
import { useUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { api } from '../../../app/api'

export function OperatorShellPage({ config, editorEnabled }: { config: PublicSeedConfig; editorEnabled: boolean }) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const navigate = useNavigate()
  const { dirty } = useUnsavedChanges()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string>()
  const signOut = async () => {
    if (dirty && !window.confirm('Sign out and discard unsaved changes?')) return
    window.dispatchEvent(new Event('pencil:auth-lost'))
    setSigningOut(true); setError(undefined)
    try { await api.signOut() }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-out failed. Your session may still be active; try again.')
      setSigningOut(false)
      window.dispatchEvent(new Event('pencil:auth-changed'))
      return
    }
    await navigate({ to: '/signin', ignoreBlocker: true })
  }
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const flowsCurrent = pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/flows/')
  const actionsCurrent = pathname === '/app/actions' || pathname.startsWith('/app/actions/')
  const analysisCurrent = pathname === '/app/analysis' || pathname.startsWith('/app/analysis/')
  return <main className="pencil-canvas operator-shell" data-hydrated={hydrated}>
    {editorEnabled ? <OwnerEditorShell /> : null}
    <header className="operator-header" style={{ flexWrap: 'wrap' }}>
      <Tooltip label={config.productName}><BrandMark href="/app" name={config.productName} /></Tooltip>
      <nav className="operator-nav" aria-label="Operator navigation">
        <Link activeOptions={{ exact: true }} aria-current={flowsCurrent ? 'page' : undefined} to="/app">Flows</Link>
        <Link activeOptions={{ exact: true }} to="/app/audience">Audience</Link>
        <Link aria-current={actionsCurrent ? 'page' : undefined} to="/app/actions">Actions</Link>
        <Link aria-current={analysisCurrent ? 'page' : undefined} to="/app/analysis">Analysis</Link>
        <Link activeOptions={{ exact: true }} to="/app/audit">Audit log</Link>
        <Link activeOptions={{ exact: true }} to="/app/settings">Settings</Link>
      </nav>
      <button className="secondary-button operator-signout focus-ring" disabled={signingOut} onClick={() => void signOut()} type="button">{signingOut ? 'Signing out…' : 'Sign out'}</button>
    </header>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    <div className="operator-content" id="workspace"><Outlet /></div>
  </main>
}
