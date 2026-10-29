import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { ForbiddenError } from '../../shared/errors'
import { resourceId, validateInput } from '../../shared/validation'
import { retentionSettingsSchema } from './model'

export function registerRetentionRoutes(app:Hono<WorkerEnvironment>) {
  app.use('/api/app/flows/:flowId/retention',async(c,next)=>{
    const native=await c.get('services').auth.native.getSession(c.req.raw)
    if(native?.operator.role!=='owner')throw new ForbiddenError('Only the installation owner can manage retention and legal hold.')
    await next()
  })
  const params=validateInput('param',z.object({flowId:resourceId}))
  app.get('/api/app/flows/:flowId/retention',params,async c=>c.json(await c.get('services').retention.read(c.get('operatorSession').workspaceId,c.req.valid('param').flowId)))
  app.put('/api/app/flows/:flowId/retention',params,validateInput('json',retentionSettingsSchema),async c=>{
    const input=c.req.valid('json'),flowId=c.req.valid('param').flowId,{workspaceId,operatorId}=c.get('operatorSession')
    const retention=c.get('services').retention,now=new Date().toISOString()
    return c.json(await retention.configure(workspaceId,operatorId,{...input,flowId},now))
  })
}
