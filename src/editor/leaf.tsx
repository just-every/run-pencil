import type { ComponentType } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useEditorLeafReady } from '../base/editor/react'

/** Called from the rendered leaf, so lazy destinations resume edits after hydration. */
export function editorLeaf(Component: ComponentType) {
  return function EditorLeaf() {
    const key = useRouterState({ select: state => state.location.href })
    useEditorLeafReady(key)
    return <Component />
  }
}
