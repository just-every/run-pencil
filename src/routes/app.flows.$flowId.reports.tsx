import { createFileRoute } from '@tanstack/react-router'
import { editorLeaf } from '../editor/leaf'
import { ReportsPage } from '../core/features/reportViews/ui/ReportsPage'
export const Route=createFileRoute('/app/flows/$flowId/reports')({
  validateSearch:(search:Record<string,unknown>):{viewId?:string}=>({viewId:typeof search.viewId==='string'&&search.viewId.length>0&&search.viewId.length<=200&&!/[\u0000-\u001f\u007f]/.test(search.viewId)?search.viewId:undefined}),
  component:editorLeaf(Page),
})
function Page(){const {flowId}=Route.useParams(),{viewId}=Route.useSearch(),navigate=Route.useNavigate();return <ReportsPage key={flowId} flowId={flowId} viewId={viewId} onViewChange={viewId=>void navigate({search:{viewId},replace:true})}/>}
