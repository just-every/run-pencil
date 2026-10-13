import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { ImportPage } from '../core/features/importing'
export const Route = createFileRoute('/app/import')({ component: editorLeaf(ImportPage) })
