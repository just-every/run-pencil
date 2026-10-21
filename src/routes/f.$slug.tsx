import { createFileRoute, notFound } from '@tanstack/react-router'
import { editorLeaf } from '../editor/leaf'
import { loadPublicConfig, loadPublicFlow } from '../core/app/loaders'
import { ResumeFlowPage } from '../core/features/responses/ui/ResumeFlowPage'
import { PaymentReturnPage } from '../core/features/responses/ui/PaymentReturnPage'
import { PublicDocument } from '../core/features/responses/ui/PublicDocument'
export const Route = createFileRoute('/f/$slug')({
  validateSearch:(search:Record<string,unknown>):{collector?:string;resume?:string;kiosk?:number;'payment-return'?:'success'|'cancel';'payment-key'?:string}=>{
    if(search.collector!==undefined && (typeof search.collector!=='string' || !/^[a-f0-9]{32}$/.test(search.collector)))throw notFound()
    if(search.resume!==undefined && (typeof search.resume!=='string' || !/^[a-f0-9]{64}$/.test(search.resume)))throw notFound()
    if(search.kiosk!==undefined && (!/^\d+$/.test(String(search.kiosk)) || Number(search.kiosk)<10 || Number(search.kiosk)>3600 || search.resume!==undefined))throw notFound()
    // PAY-001: Stripe Checkout's success and cancel links carry the attempt's return key.
    const paid=search['payment-key']
    if(paid!==undefined && (typeof paid!=='string' || !/^[a-f0-9]{64}$/.test(paid) || !['success','cancel'].includes(String(search['payment-return'])) || search.resume!==undefined || search.kiosk!==undefined))throw notFound()
    return { ...(search.kiosk===undefined?{}:{kiosk:Number(search.kiosk)}), ...(search.collector===undefined?{}:{collector:search.collector as string}), ...(search.resume===undefined?{}:{resume:search.resume as string}), ...(paid===undefined?{}:{'payment-key':paid as string,'payment-return':search['payment-return'] as 'success'|'cancel'}) }
  },
  loaderDeps:({search})=>({collector:search.collector,resume:search.resume,payment:search['payment-key']}),
  loader:async({params,deps})=>{
    // A return from Stripe shows the respondent's own response even after the form closes.
    if(deps.payment)return {config:await loadPublicConfig(),data:{state:'payment' as const}}
    const [config,data]=await Promise.all([loadPublicConfig(),loadPublicFlow({data:{slug:params.slug,source:'direct',collectorKey:deps.resume?undefined:deps.collector}})])
    return {config,data:deps.resume?{state:'resume' as const}:data}
  },
  head:({loaderData})=>loaderData?.data.state==='resume'||loaderData?.data.state==='payment'?{meta:[{name:'robots',content:'noindex, nofollow'}]}:{},
  component:editorLeaf(Page),
})
function Page(){const {config,data}=Route.useLoaderData();const search=Route.useSearch();const {resume,kiosk}=search;const {slug}=Route.useParams();if(data.state==='resume' && resume)return <ResumeFlowPage config={config} slug={slug} token={resume}/>;if(data.state==='payment' && search['payment-key'] && search['payment-return'])return <PaymentReturnPage config={config} slug={slug} token={search['payment-key']} outcome={search['payment-return']}/>;if(data.state==='resume'||data.state==='payment')throw notFound();return <PublicDocument kioskIdleSeconds={kiosk} config={config} data={data} slug={slug}/>}
