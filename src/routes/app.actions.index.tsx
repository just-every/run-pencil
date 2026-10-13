import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { ActionsPage } from '../core/features/actions/ui/ActionsPage'
export const Route = createFileRoute('/app/actions/')({ component: editorLeaf(ActionsPage) })
