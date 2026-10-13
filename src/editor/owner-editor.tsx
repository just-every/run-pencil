import { useEffect, useState } from 'react'
import { configLoader, createOwnerEditor } from '../base/editor'
import type { Session } from '../base/operator-auth/index.mjs'

export function OwnerEditorShell() {
  const [error, setError] = useState<string>()
  useEffect(() => {
    const editor = createOwnerEditor(), controller = new AbortController()
    let identity = '', pending = false, stopped = false, suspended = false, generation = 0
    const revoke = () => { generation++; identity = ''; editor.setOwner(false) }
    const refresh = async () => {
      if (pending || stopped || suspended) return
      pending = true
      const currentGeneration = generation
      try {
        const response = await fetch('/auth/session', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal })
        if (!response.ok) { revoke(); return }
        const session = await response.json() as Session
        if (currentGeneration !== generation || stopped) return
        if (session.operator?.role !== 'owner') { revoke(); return }
        const grant = await fetch('/api/editor/config', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal })
        if (currentGeneration !== generation || stopped) return
        // Missing optional management configuration leaves ordinary Pencil usable.
        if (grant.status === 404) { revoke(); return }
        if (grant.status === 403) { revoke(); return }
        if (!grant.ok) throw new Error('Editor configuration unavailable')
        const current = JSON.stringify([session.id, session.operator.id])
        if (current !== identity) { editor.setOwner(true); identity = current }
        await editor.refresh(configLoader('/api/editor/config', location.origin))
        if (!stopped) setError(undefined)
      } catch {
        revoke()
        if (!stopped && !controller.signal.aborted) setError('The editor could not connect. Focus this window to try again.')
      } finally { pending = false }
    }
    const changed = () => { suspended = false; revoke(); void refresh() }
    const authorityLost = () => { suspended = true; revoke() }
    window.addEventListener('pencil:auth-changed', changed)
    window.addEventListener('pencil:auth-lost', authorityLost)
    window.addEventListener('focus', () => void refresh(), { signal: controller.signal })
    const timer = setInterval(() => void refresh(), 20_000)
    void refresh()
    return () => { stopped = true; controller.abort(); clearInterval(timer); editor.dispose(); window.removeEventListener('pencil:auth-changed', changed); window.removeEventListener('pencil:auth-lost', authorityLost) }
  }, [])
  return error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null
}
