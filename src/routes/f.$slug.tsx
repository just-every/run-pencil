import { createFileRoute, notFound } from '@tanstack/react-router'
import { editorLeaf } from '../editor/leaf'
import { loadPublicConfig, loadPublicFlow } from '../core/app/loaders'
import { ResumeFlowPage } from '../core/features/responses/ui/ResumeFlowPage'
import { PublicDocument } from '../core/features/responses/ui/PublicDocument'
export const Route = createFileRoute('/f/$slug')({
  validateSearch:(search:Record<string,unknown>):{collector?:string;resume?:string;kiosk?:number}=>{
    if(search.collector!==undefined && (typeof search.collector!=='string' || !/^[a-f0-9]{32}$/.test(search.collector)))throw notFound()
    if(search.resume!==undefined && (typeof search.resume!=='string' || !/^[a-f0-9]{64}$/.test(search.resume)))throw notFound()
    if(search.kiosk!==undefined && (!/^\d+$/.test(String(search.kiosk)) || Number(search.kiosk)<10 || Number(search.kiosk)>3600 || search.resume!==undefined))throw notFound()
    return { ...(search.kiosk===undefined?{}:{kiosk:Number(search.kiosk)}), ...(search.collector===undefined?{}:{collector:search.collector as string}), ...(search.resume===undefined?{}:{resume:search.resume as string}) }
  },
  loaderDeps:({search})=>({collector:search.collector,resume:search.resume}),
  loader:async({params,deps})=>{
    const [config,data]=await Promise.all([loadPublicConfig(),loadPublicFlow({data:{slug:params.slug,source:'direct',collectorKey:deps.resume?undefined:deps.collector}})])
    return {config,data:deps.resume?{state:'resume' as const}:data}
  },
  head:({loaderData})=>loaderData?.data.state==='resume'?{meta:[{name:'robots',content:'noindex, nofollow'}]}:{},
  component:editorLeaf(Page),
})
function Page(){const {config,data}=Route.useLoaderData();const {resume,kiosk}=Route.useSearch();const {slug}=Route.useParams();if(data.state==='resume' && resume)return <ResumeFlowPage config={config} slug={slug} token={resume}/>;if(data.state==='resume')throw notFound();return <PublicDocument kioskIdleSeconds={kiosk} config={config} data={data} slug={slug}/>}
