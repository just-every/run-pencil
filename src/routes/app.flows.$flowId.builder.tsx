import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { FlowBuilderPage } from '../core/features/flows/ui/FlowBuilderPage'
export const Route = createFileRoute('/app/flows/$flowId/builder')({  component: editorLeaf(Page) })
function Page() { return <FlowBuilderPage key={Route.useParams().flowId} /> }
