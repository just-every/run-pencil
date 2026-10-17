import { createFileRoute } from '@tanstack/react-router'
import { editorLeaf } from '../editor/leaf'
import { DashboardPage } from '../core/features/reportViews/ui/DashboardPage'
export const Route=createFileRoute('/app/flows/$flowId/dashboard')({component:editorLeaf(Page)})
function Page(){const {flowId}=Route.useParams();return <DashboardPage key={flowId} flowId={flowId}/>}
