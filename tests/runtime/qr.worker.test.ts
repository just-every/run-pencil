import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { matureLoad } from './load-time-fixture'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie=''
const request=(path:string,data?:unknown,method=data===undefined?'GET':'POST',auth=true)=>SELF.fetch('http://localhost'+path,{method,headers:{Host:'localhost',Origin:'http://localhost',cookie:auth?cookie:'','content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),redirect:'manual'})
async function call(path:string,data?:unknown){const r=await request(path,data);expect(r.ok,await r.clone().text()).toBe(true);return r.json<any>()}
beforeAll(async()=>{
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__);await call('/health')
  const owner=await env.DB.prepare('SELECT email FROM operators ORDER BY created_at,id LIMIT 1').first<{email:string}>()
  await call('/auth/magic-link',{email:owner!.email});const inbox=await developmentInbox(path=>SELF.fetch('http://localhost'+path,{headers:{Host:'localhost',...devKeyHeaders}}),owner!.email)
  const login=await request('/auth/confirm',{token:inbox.messages[0].magicLinkToken});expect(login.status).toBe(303);cookie=login.headers.get('set-cookie')!.split(';')[0]
})
contract('DIST-012','QR downloads require operator authority, retain the exact collection link and reject unrelated collectors and formats',async()=>{
  const flow=await call('/api/app/flows',{title:'Aurora counter survey',slug:'aurora-qr'})
  const root=`/api/app/flows/${flow.id}`,collector=await call(root+'/collectors',{name:'Counter <east>',channel:'qr'})
  const path=root+`/collectors/${collector.id}/qr`
  expect((await request(path,undefined,'GET',false)).status).toBe(401)
  const svg=await request(path+'?format=svg');expect(svg.status).toBe(200);expect(svg.headers.get('content-type')).toContain('image/svg+xml');const text=await svg.text();expect(text).toContain('Counter &lt;east&gt;');expect(text).toContain(collector.publicPath.replaceAll('&','&amp;'))
  const png=await request(path+'?format=png');expect(png.status).toBe(200);expect(png.headers.get('content-disposition')).toMatch(/^attachment;/);expect([...new Uint8Array(await png.arrayBuffer()).slice(0,8)]).toEqual([137,80,78,71,13,10,26,10])
  expect((await request(path+'?format=pdf')).status).toBe(400)
  const other=await call('/api/app/flows',{title:'Another form',slug:'other-aurora-qr'})
  expect((await request(`/api/app/flows/${other.id}/collectors/${collector.id}/qr`)).status).toBe(404)
  const direct=await request(root+'/qr');expect(await direct.text()).toContain('/f/aurora-qr')
  let draft=await call(root+'/draft')
  await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step:{kind:'question',questionType:'short_text',required:true,prompt:'What could Aurora improve?'}})
  draft=await call(root+'/draft');const stepId=draft.steps[0].id
  await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'Thank you.'}})
  draft=await call(root+'/draft');await call(root+'/publish',{expectedVersion:draft.flow.draftVersion})
  const sources=await call(root+'/collectors')
  for(const source of sources.filter((row:any)=>row.systemSource)){
    if(['direct','embed'].includes(source.systemSource)){
      const url=new URL(source.publicPath,'http://localhost');expect(url.pathname).toBe('/f/aurora-qr')
      const view=await call('/api/public/flows/aurora-qr/views',{revisionId:(await call('/api/public/flows/aurora-qr')).revision.id,source:'direct',collectorKey:source.publicKey})
      const session=await call('/api/public/flows/aurora-qr/sessions',{deviceClass:'desktop',source:'direct',collectorKey:source.publicKey});await matureLoad(session)
      const receipt=await call('/api/public/flows/aurora-qr/responses',{...session,idempotencyKey:'qr-default-'+session.sessionId,answers:[{stepId,value:'Offer an earlier workshop.'}]})
      expect((await call(root+'/ledger')).responses.find((row:any)=>row.id===receipt.responseId)).toMatchObject({source:source.systemSource,collector:{id:source.id}})
      expect(view.loadTime).toBeTruthy()
    }else{
      expect(source.publicPath).toBeNull()
      expect((await request(root+`/collectors/${encodeURIComponent(source.id)}/qr?format=png`)).status).toBe(400)
    }
  }
})
