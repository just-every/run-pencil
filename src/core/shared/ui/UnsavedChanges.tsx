import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useBlocker } from '@tanstack/react-router'

type UnsavedState = { dirty: boolean; update: (id: string, dirty: boolean) => void }
const UnsavedChanges = createContext<UnsavedState | undefined>(undefined)

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const edits = useRef(new Set<string>())
  const [dirty, setDirty] = useState(false)
  const update = useCallback((id: string, changed: boolean) => {
    if (changed) edits.current.add(id)
    else edits.current.delete(id)
    setDirty(edits.current.size > 0)
  }, [])
  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: () => edits.current.size > 0,
    shouldBlockFn: () => edits.current.size > 0 && !window.confirm('Leave this page and discard unsaved changes?'),
  })
  const value = useMemo(() => ({ dirty, update }), [dirty, update])
  return <UnsavedChanges.Provider value={value}>{children}</UnsavedChanges.Provider>
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChanges)
  if (!context) throw new Error('Editable operator pages require the unsaved-changes provider.')
  return context
}

export function useProtectUnsavedChanges(dirty: boolean) {
  const { update } = useUnsavedChanges()
  const id = useId()
  useEffect(() => { update(id, dirty); return () => update(id, false) }, [dirty, id, update])
  // A confirmed persistence acknowledgement can clear this editor immediately,
  // before navigating; other open editors still keep their own protection.
  return useCallback(() => update(id, false), [id, update])
}
