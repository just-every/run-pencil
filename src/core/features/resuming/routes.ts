import { formLimits } from '../../shared/formLimits'
import type { Hono, Context } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { answerValue, flowSlug, resourceId, validateInput } from '../../shared/validation'
import { FlowClosedError, PencilError } from '../../shared/errors'

const slug = z.object({slug:flowSlug})
const save = z.object({hidden:z.record(z.string().max(64),z.union([z.string().max(1000),z.number(),z.boolean()])).refine(value=>Object.keys(value).length<=100).optional(),sessionId:resourceId,sessionToken:z.string().min(32).max(200),commandKey:z.string().min(12).max(100).regex(/^[A-Za-z0-9_-]+$/),email:z.string().trim().email().max(254),currentStepId:resourceId,answers:z.array(z.object({stepId:resourceId,value:answerValue})).max(formLimits.questions.perRevision),invitationToken:z.string().regex(/^[a-f0-9]{64}$/).optional()})
function failure(context: Context<WorkerEnvironment>, error: unknown) {
  if (error instanceof FlowClosedError) return context.json({error:error.code,message:error.message,closedFlow:error.flow},409)
  if (error instanceof PencilError) return context.json({error:error.code,message:error.message},error.code==='RATE_LIMITED'?429:error.code==='RESUME_MAIL_UNAVAILABLE'?503:400)
  throw error
}
export function registerResumeRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.use('/api/public/flows/:slug/resume',async (c,next)=>{
    c.header('Cache-Control','no-store');c.header('Referrer-Policy','no-referrer');c.header('X-Robots-Tag','noindex, nofollow')
    await next()
  })
  app.use('/api/public/flows/:slug/sessions/save',async (c,next)=>{
    c.header('Cache-Control','no-store');c.header('Referrer-Policy','no-referrer');c.header('X-Robots-Tag','noindex, nofollow')
    await next()
  })
  app.post('/api/public/flows/:slug/sessions/save',validateInput('param',slug),validateInput('json',save),async c=>{
    try { return c.json(await services(c).resuming.save({slug:c.req.param('slug'),...c.req.valid('json'),clientAddress:c.req.header('CF-Connecting-IP')})) }
    catch(error){return failure(c,error)}
  })
  app.post('/api/public/flows/:slug/resume',validateInput('param',slug),validateInput('json',z.object({token:z.string().regex(/^[a-f0-9]{64}$/)})),async c=>{
    try{
      const value=await services(c).resuming.resolve(c.req.param('slug'),c.req.valid('json').token)
      if(value.state==='open') {
        const timing=await services(c).traffic.resumedView(value.sessionId,value.flow.flow.id,value.revisionId)
        return c.json({...value,...timing})
      }
      return c.json(value)
    }
    catch(error){return failure(c,error)}
  })
}
