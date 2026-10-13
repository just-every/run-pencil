import { developmentInbox } from '../helpers/development-outbox'
import { createD1DevelopmentOutbox, createDevelopmentOutboxHandler } from '../../src/base/mail/src/development/index.mjs'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { createPencilServices } from '../../src/core/app/services'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
contract(['BASE-OPS-002','BASE-ACCESS-001','OPER-002'], 'additive Base adoption preserves existing operators and migration history, revokes legacy bearers and imports their authority exactly once', async () => {
  expect(__PENCIL_CORE_MIGRATIONS__[10].name).toBe('0010_base_operator_auth.sql')
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__.slice(0,10))
  const now = new Date().toISOString(), future=new Date(Date.now()+86400_000).toISOString()
  const id='01J00000000000000000000991'
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,created_at,updated_at,setup_operator_initialized_at) VALUES ('legacy-workspace','Preserved owner workspace','UTC',?,?,?)").bind(now,now,now),
    env.DB.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES (?,'legacy-workspace','existing@example.test','Preserved operator',1,?,?)").bind(id,now,now),
    env.DB.prepare("INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,last_active_at,created_at,updated_at) VALUES ('old-session',?,'old-hash',?,?,?,?)").bind(id,future,now,now,now),
    env.DB.prepare("INSERT INTO auth_magic_links(id,operator_id,token_hash,expires_at,created_at) VALUES ('old-link',?,'old-link-hash',?,?)").bind(id,future,now),
  ])
  const original = await env.DB.prepare('SELECT * FROM operators').all()
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__)
  expect((await env.DB.prepare('SELECT * FROM operators').all()).results).toEqual(original.results)
  expect(await env.DB.prepare('SELECT operator_id,auth_id FROM operator_auth_links').first()).toEqual({operator_id:id,auth_id:id})
  expect(await env.DB.prepare('SELECT id,email,display_name,role,status FROM oa_operators').first()).toEqual({id,email:'existing@example.test',display_name:'Preserved operator',role:'owner',status:'active'})
  expect(await env.DB.prepare('SELECT count(*) n FROM operator_sessions WHERE revoked_at IS NOT NULL').first()).toEqual({n:1})
  expect(await env.DB.prepare('SELECT count(*) n FROM auth_magic_links WHERE revoked_at IS NOT NULL').first()).toEqual({n:1})
  expect(await env.DB.prepare('SELECT count(*) n FROM oa_bootstrap').first()).toEqual({n:1})
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__)
  expect((await env.DB.prepare('SELECT * FROM operators').all()).results).toEqual(original.results)
  const services=createPencilServices(createPencilPlatform('http://localhost',env))
  expect(await services.auth.getSession(new Request('http://localhost/app',{headers:{Host:'localhost',Cookie:'pencil_operator_session=old-credential'}}))).toBeUndefined()
  const request=new Request('http://localhost/auth/magic-link',{method:'POST',headers:{Host:'localhost',Origin:'http://localhost'}})
  await services.auth.native.requestMagicLink(request,{email:'existing@example.test'})
  const viewer=createDevelopmentOutboxHandler({local:true,origin:'http://localhost',outbox:createD1DevelopmentOutbox({db:env.DB})})
  const {messages:inbox}=await developmentInbox(async path => (await viewer(new Request('http://localhost'+path,{headers:{Host:'localhost'}})))!, 'existing@example.test')
  const result=await services.auth.native.confirmLink(new Request('http://localhost/auth/confirm',{method:'POST',headers:{Host:'localhost',Origin:'http://localhost'}}),{token:inbox[0].magicLinkToken})
  expect(await services.auth.getSession(new Request('http://localhost/app',{headers:{Host:'localhost',Cookie:result.cookie.split(';')[0]}}))).toMatchObject({operatorId:id,workspaceId:'legacy-workspace',email:'existing@example.test'})
})
