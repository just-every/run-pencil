import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { RequestAnalysisPage, type RequestSearch } from '../core/features/analysis/ui/RequestAnalysisPage'
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : undefined
export const Route = createFileRoute('/app/analysis/new')({
  validateSearch: (search: Record<string, unknown>): RequestSearch => ({ flowId: id(search.flowId), revisionId: id(search.revisionId) }),
  component: editorLeaf(Page),
})
function Page() { return <RequestAnalysisPage search={Route.useSearch()} /> }
