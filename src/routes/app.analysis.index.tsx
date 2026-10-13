import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { AnalysisPage } from '../core/features/analysis/ui/AnalysisPage'
export const Route = createFileRoute('/app/analysis/')({ component: editorLeaf(AnalysisPage) })
