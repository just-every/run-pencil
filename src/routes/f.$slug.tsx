import { createFileRoute, notFound } from '@tanstack/react-router'
import { editorLeaf } from '../editor/leaf'
import { loadPublicConfig, loadPublicFlow } from '../core/app/loaders'
import { PublicDocument } from '../core/features/responses/ui/PublicDocument'
export const Route = createFileRoute('/f/$slug')({
  validateSearch:(search:Record<string,unknown>):{collector?:string}=>{
    if(search.collector!==undefined && (typeof search.collector!=='string' || !/^[a-f0-9]{32}$/.test(search.collector)))throw notFound()
    return search.collector===undefined?{}:{collector:search.collector as string}
  },
  loaderDeps:({search})=>({collector:search.collector}),
  loader:async({params,deps})=>({config:await loadPublicConfig(),data:await loadPublicFlow({data:{slug:params.slug,source:'direct',collectorKey:deps.collector}})}),component:editorLeaf(Page),
})
function Page(){const {config,data}=Route.useLoaderData();return <PublicDocument config={config} data={data} slug={Route.useParams().slug}/>}
