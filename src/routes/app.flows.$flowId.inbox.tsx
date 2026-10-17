import { createFileRoute } from '@tanstack/react-router'
import { InboxPage } from '../core/features/submissions/ui/InboxPage'
export const Route = createFileRoute('/app/flows/$flowId/inbox')({ component: Page })
function Page() { return <InboxPage key={Route.useParams().flowId} flowId={Route.useParams().flowId} /> }
