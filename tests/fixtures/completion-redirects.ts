import type { BuilderDraft } from '../../src/core/app/api'
export async function completionFixture(call:<T>(path:string,data?:unknown,method?:string)=>Promise<T>,slug:string) {
  const {id}=await call<{id:string}>('/api/app/flows',{title:'Sales consultation',slug})
  const base=`/api/app/flows/${id}`,read=()=>call<BuilderDraft>(`${base}/draft`)
  for(const step of [
    {kind:'question',questionType:'csat',prompt:'How satisfied are you?',required:true},
    {kind:'question',questionType:'number',prompt:'Team size',required:true,questionSettings:{min:1,max:100,decimalPlaces:0}},
    {kind:'question',questionType:'yes_no',prompt:'Ready for a consultation?',required:true},
    {kind:'completion',questionType:null,prompt:'We will keep in touch'},
    {kind:'completion',questionType:null,prompt:'Book your consultation'},
  ])await call(`${base}/draft/steps`,{expectedVersion:(await read()).flow.draftVersion,step})
  const [score,size,ready,ordinary,redirect]=(await read()).steps
  const settings={hiddenFields:[{id:'plan',name:'plan',type:'text' as const,category:'plain' as const}],identityMode:'anonymous' as const,redirectOrigins:['https://sales.example.test'],calculations:[{id:'total',name:'Estimated total',type:'number' as const,expression:{kind:'multiply' as const,left:{kind:'answer' as const,stepId:size.id},right:{kind:'literal' as const,value:2}}}]}
  await call(`${base}/draft/settings`,{expectedVersion:(await read()).flow.draftVersion,settings},'PUT')
  await call(`${base}/draft/branches`,{expectedVersion:(await read()).flow.draftVersion,rules:[{sourceStepId:ready.id,predicateKind:'equals',expectedValue:null,destinationStepId:redirect.id,position:0,condition:{kind:'group',join:'and',conditions:[{kind:'test',stepId:ready.id,operator:'equals',value:true},{kind:'test',stepId:'hidden:plan',operator:'equals',value:'enterprise'},{kind:'test',stepId:'variable:total',operator:'greater_than_or_equal',value:100},{kind:'test',stepId:score.id,operator:'greater_than_or_equal',value:4}]}}]},'PUT')
  return {id,base,read,settings,score,size,ready,ordinary,redirect,call}
}
