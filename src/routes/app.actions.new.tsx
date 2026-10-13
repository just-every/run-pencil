import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { NewActionPage, type EvidenceSearch } from '../core/features/actions/ui/NewActionPage'
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : undefined
export const Route = createFileRoute('/app/actions/new')({
  validateSearch: (search: Record<string, unknown>): EvidenceSearch => ({ flowId: id(search.flowId), revisionId: id(search.revisionId), questionId: id(search.questionId), analysisId: id(search.analysisId) }),
  component: editorLeaf(Page),
})
function Page() { return <NewActionPage search={Route.useSearch()} operatorId={Route.useRouteContext().operatorId} /> }
