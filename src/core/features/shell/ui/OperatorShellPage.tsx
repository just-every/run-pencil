import { useEffect, useState } from 'react'
import { Link, Outlet, useRouterState, useNavigate } from '@tanstack/react-router'
import { Home, LogOut, Settings } from 'lucide-react'
import { BrandMark } from '../../../app/ui/BrandMark'
import type { PublicSeedConfig } from '../../../shared/config'
import { useUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { api } from '../../../app/api'

export function OperatorShellPage({ config }: { config: PublicSeedConfig }) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const navigate = useNavigate()
  const { dirty } = useUnsavedChanges()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string>()
  const signOut = async () => {
    if (dirty && !window.confirm('Sign out and discard unsaved changes?')) return
    setSigningOut(true); setError(undefined)
    try { await api.signOut() }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-out failed. Your session may still be active; try again.')
      setSigningOut(false)
      return
    }
    await navigate({ to: '/signin', ignoreBlocker: true })
  }
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return <main className="pencil-canvas operator-shell" data-hydrated={hydrated}>
    <header className="operator-header">
      <BrandMark href="/app" name={config.productName} />
      <nav className="operator-nav" aria-label="Operator navigation">
        <Link data-active={pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/flows/')} to="/app"><Home aria-hidden="true" size={15} style={{ verticalAlign: 'text-bottom' }} /> Flows</Link>
        <Link data-active={pathname === '/app/settings'} to="/app/settings"><Settings aria-hidden="true" size={15} style={{ verticalAlign: 'text-bottom' }} /> Settings</Link>
        <button className="quiet-button focus-ring" disabled={signingOut} onClick={() => void signOut()} type="button"><LogOut aria-hidden="true" size={15} /> {signingOut ? 'Signing out…' : 'Sign out'}</button>
      </nav>
    </header>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    <div className="operator-content" id="workspace"><Outlet /></div>
  </main>
}
