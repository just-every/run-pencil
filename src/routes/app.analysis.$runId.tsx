import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { FindingsPage } from '../core/features/analysis/ui/FindingsPage'
export const Route = createFileRoute('/app/analysis/$runId')({ component: editorLeaf(Page) })
function Page() { const { runId } = Route.useParams(); return <FindingsPage key={runId} runId={runId} /> }
