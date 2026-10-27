import { collectorId, CollectorClosedError } from '../collectors'
import type { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { contactSchema, contactLimits, contactTimeZoneMessage } from './contact-model'
import { segmentSchema } from './segments'
import { validateInput, resourceId, invalidInput } from '../../shared/validation'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
const validateContact = () => zValidator('json', contactSchema, (result, context) => {
  if (!result.success) return result.error.issues.some(issue => issue.path[0] === 'timeZone')
    ? context.json({ error: 'VALIDATION_ERROR', message: contactTimeZoneMessage }, 400)
    : invalidInput(context, 'json')
})
export function registerDistributionRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/distribution/contacts',validateInput('query',z.object({q:z.string().max(200).optional(),offset:z.coerce.number().int().min(0).max(contactLimits.total).default(0),limit:z.coerce.number().int().min(1).max(1000).default(250)})), async c => c.json(await services(c).distribution.contacts.list(c.get('operatorSession').workspaceId,c.req.valid('query').q ?? '',c.req.valid('query').offset,c.req.valid('query').limit)))
  app.post('/api/app/distribution/contacts', validateContact(), async c => c.json(await services(c).distribution.contacts.save(c.get('operatorSession').workspaceId, c.req.valid('json'),c.get('operatorSession').operatorId), 201))
  app.put('/api/app/distribution/contacts/:id',validateInput('param',z.object({id:resourceId})),validateContact(),async c=>c.json(await services(c).distribution.contacts.edit(c.get('operatorSession').workspaceId,c.req.param('id'),c.req.valid('json'),c.get('operatorSession').operatorId)))
  app.post('/api/app/distribution/contacts/import',validateInput('json',z.object({csv:z.string().max(contactLimits.csvBytes),commit:z.boolean().optional(),updateMatches:z.boolean().optional()})),async c=>{
    const op=c.get('operatorSession');return c.json(await services(c).distribution.importer.run(op.workspaceId,op.operatorId,c.req.valid('json')))
  })
  app.get('/api/app/distribution/segments',async c=>c.json(await services(c).distribution.segments.list(c.get('operatorSession').workspaceId)))
  app.post('/api/app/distribution/segments',validateInput('json',segmentSchema),async c=>c.json(await services(c).distribution.segments.save(c.get('operatorSession').workspaceId,c.req.valid('json')),201))
  app.put('/api/app/distribution/segments/:id',validateInput('param',z.object({id:resourceId})),validateInput('json',segmentSchema),async c=>c.json(await services(c).distribution.segments.save(c.get('operatorSession').workspaceId,c.req.valid('json'),c.req.param('id'))))
  app.delete('/api/app/distribution/segments/:id',validateInput('param',z.object({id:resourceId})),async c=>{const op=c.get('operatorSession');await services(c).distribution.segments.erase(op.workspaceId,c.req.param('id'),op.operatorId);return c.body(null,204)})
  app.post('/api/app/distribution/contacts/:id/erase', validateInput('param', z.object({ id: resourceId })), validateInput('json', z.object({ confirm: z.literal(true) })), async c => {
    const operator = c.get('operatorSession')
    return c.json(await services(c).distribution.contacts.erase(operator.workspaceId, c.req.param('id'), operator.operatorId))
  })
  app.post('/api/app/distribution/contacts/:id/consent', validateInput('param', z.object({ id: resourceId })), validateInput('json', z.object({ renewed: z.boolean(), source: z.string().trim().min(1).max(200) })), async c => {
    const operator = c.get('operatorSession')
    await services(c).distribution.contacts.consent({ workspaceId: operator.workspaceId, contactId: c.req.param('id'), actor: operator.operatorId, ...c.req.valid('json') })
    return c.body(null, 204)
  })
  app.get('/api/app/flows/:flowId/distribution', validateInput('param', z.object({ flowId: resourceId })), async c => c.json({ sender: { available: true, message: c.get('platform').configuration.mail.kind === 'local-development' ? 'Email is suppressed in this development or demo installation. A sent outcome records a completed local attempt; no email is delivered.' : 'Delivery uses the configured mail provider. Pending invitations are waiting to be sent. Each delivery attempt and outcome is recorded below.' }, launches:await services(c).distribution.launches.history(c.get('operatorSession').workspaceId,c.req.param('flowId')), participants: await services(c).distribution.launches.list(c.get('operatorSession').workspaceId, c.req.param('flowId')) }))
  app.post('/api/app/flows/:flowId/distribution', validateInput('param', z.object({ flowId: resourceId })), validateInput('json', z.object({ contactIds: z.array(resourceId).min(1).max(contactLimits.participantsPerRevision).optional(),segmentId:resourceId.optional(), channel:z.enum(['email','sms']).optional(), collectorId:collectorId.optional(), commandKey: z.string().min(12).max(200) }).refine(v=>!(v.contactIds&&v.segmentId),'Choose contacts or a segment.')), async c => {
    const operator = c.get('operatorSession')
    try {
      const replay=await services(c).distribution.launches.commandComplete(operator.workspaceId,c.req.valid('json').commandKey)
      const launch = await services(c).distribution.launches.launch({ workspaceId: operator.workspaceId, operatorId: operator.operatorId, flowId: c.req.param('flowId'), ...c.req.valid('json') })
      if(!replay) await services(c).distribution.dispatcher.run()
      return c.json(launch, 201)
    } catch(error) {
      if(error instanceof CollectorClosedError) return c.json({error:error.code,message:error.message},409)
      throw error
    }
  })
  app.post('/api/app/distribution/deliveries/:id/retry', validateInput('param', z.object({ id: resourceId })), validateInput('json', z.object({ duplicateRiskAccepted: z.boolean() })), async c => {
    const operator = c.get('operatorSession')
    await services(c).distribution.deliveries.retry(operator.workspaceId, c.req.param('id'), operator.operatorId, c.req.valid('json').duplicateRiskAccepted)
    await services(c).distribution.dispatcher.run()
    return c.body(null, 204)
  })
  app.post('/api/public/optout', validateInput('json', z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })), async c => {
    await services(c).distribution.contacts.optOut(c.req.valid('json').token)
    return c.body(null, 204)
  })
}
