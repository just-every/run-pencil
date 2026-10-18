import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { resourceId, flowSlug, validateInput } from '../../shared/validation'
import { ValidationError } from '../../shared/errors'
import { accessRuleInput } from './service'

export function registerAccessRoutes(app:Hono<WorkerEnvironment>,services:RequestServices){
  const params=z.object({flowId:resourceId})
  app.get('/api/app/flows/:flowId/access',validateInput('param',params),async c=>{
    const draft=await services(c).flows.getBuilderDraft(c.get('operatorSession').workspaceId,c.req.param('flowId'))
    const ref=draft.formSettings?.access
    if(!ref)return c.json({mode:'open'})
    const row=await c.get('platform').databaseBinding.prepare('SELECT mode,domains_json,emails_json,public_key FROM form_access_rules WHERE id=? AND flow_id=?').bind(ref.id,draft.flow.id).first<{mode:string;domains_json:string;emails_json:string;public_key:string|null}>()
    return c.json(row?{mode:row.mode,domains:JSON.parse(row.domains_json),emails:JSON.parse(row.emails_json),publicKey:row.public_key}:{mode:ref.mode,unavailable:true})
  })
  app.put('/api/app/flows/:flowId/access',validateInput('param',params),validateInput('json',z.object({expectedVersion:z.number().int().nonnegative(),rule:z.union([accessRuleInput,z.object({mode:z.literal('open')}).strict()])}).strict()),async c=>{
    const op=c.get('operatorSession'),{rule,expectedVersion}=c.req.valid('json'),flowId=c.req.param('flowId')
    const draft=await services(c).flows.getBuilderDraft(op.workspaceId,flowId)
    if(draft.flow.draftVersion!==expectedVersion)throw new ValidationError('Another operator saved first. Reload this form before changing access.')
    const access=rule.mode==='open'?undefined:await services(c).access.createRule(flowId,rule)
    const result=await services(c).flows.updateFormSettings({workspaceId:op.workspaceId,operatorId:op.operatorId,flowId,expectedVersion,settings:{...draft.formSettings!,access}})
    return c.json(result)
  })
  app.get('/api/public/invitations/:token',validateInput('param',z.object({token:z.string().regex(/^[a-f0-9]{64}$/)})),async c=>c.json((await services(c).responses.invitationFlow(c.req.param('token'),c.req.header('x-pencil-access'))).publicFlow))
  const publicParams=z.object({slug:flowSlug}),location={revisionId:resourceId}
  app.post('/api/public/flows/:slug/access/code',validateInput('param',publicParams),validateInput('json',z.object({...location,email:z.string().email().max(320)}).strict()),async c=>{
    await services(c).responses.enforcePublicRequestRateLimit({clientAddress:c.req.header('CF-Connecting-IP'),scope:'session'})
    return c.json(await services(c).access.requestCode({slug:c.req.param('slug'),...c.req.valid('json')}),201)
  })
  app.post('/api/public/flows/:slug/access',validateInput('param',publicParams),validateInput('json',z.object({...location,password:z.string().min(1).max(256).optional(),challengeId:resourceId.optional(),code:z.string().regex(/^\d{6}$/).optional(),signedLink:z.string().max(8192).optional()}).strict()),async c=>{
    await services(c).responses.enforcePublicRequestRateLimit({clientAddress:c.req.header('CF-Connecting-IP'),scope:'session'})
    return c.json(await services(c).access.unlock({slug:c.req.param('slug'),...c.req.valid('json')}))
  })
}
