import { env, SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import { foundationFixture } from './foundation-fixture'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
export async function audienceFixture(slug:string) {
  const f=await foundationFixture(slug)
  await f.add({kind:'question',questionType:'short_text',prompt:'Feedback',required:true});await f.add({kind:'completion',questionType:null,prompt:'Done'});await f.publish()
  const op=await env.DB.prepare('SELECT email FROM operators WHERE id=?').bind(f.operatorId).first<{email:string}>()
  await SELF.fetch('http://localhost/auth/magic-link',{method:'POST',headers:{Host:'localhost',Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({email:op!.email})})
  const inbox=await developmentInbox(path=>SELF.fetch(`http://localhost${path}`,{headers:{Host:'localhost',...devKeyHeaders}}),op!.email)
  const login=await SELF.fetch('http://localhost/auth/confirm',{method:'POST',headers:{Host:'localhost',Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({token:inbox.messages[0].magicLinkToken}),redirect:'manual'})
  expect(login.status).toBe(303)
  const cookie=login.headers.get('set-cookie')!.split(';')[0]
  const call=(path:string,method='GET',body?:unknown,auth=true,origin='http://localhost')=>SELF.fetch(`http://localhost${path}`,{method,headers:{Host:'localhost',Origin:origin,Cookie:auth?cookie:'','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  return {...f,call}
}
