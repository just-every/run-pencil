import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/mail-capture.mjs'
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
})
