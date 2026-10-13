import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { ResultsPage } from '../core/features/results/ui/ResultsPage'
export const Route = createFileRoute('/app/flows/$flowId/results')({  component: editorLeaf(Page) })
function Page() { return <ResultsPage key={Route.useParams().flowId} /> }
