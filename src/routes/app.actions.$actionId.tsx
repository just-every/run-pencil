import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { ActionPage } from '../core/features/actions/ui/ActionPage'
export const Route = createFileRoute('/app/actions/$actionId')({ component: editorLeaf(Page) })
function Page() { const { actionId } = Route.useParams(); return <ActionPage key={actionId} actionId={actionId} /> }
