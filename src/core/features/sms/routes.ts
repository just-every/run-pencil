import type { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { WorkerEnvironment } from '../../app/environment'
import { requireConnectionOwner } from '../../app/connection-owner'
import { smsConnectionSchema } from '../../platform/config/connections'
import { emptyMutationBody,validateInput } from '../../shared/validation'
import { recordOperatorAudit } from '../audit'
export function registerSmsRoutes(app:Hono<WorkerEnvironment>){
 const path='/api/app/connections/sms'
 app.get(path,async c=>c.json(await c.get('services').connections.smsStatus()))
 app.put(path,validateInput('json',smsConnectionSchema),async c=>{await requireConnectionOwner(c);await c.get('services').connections.saveSms(c.req.valid('json'),c.get('operatorSession').workspaceId);await recordOperatorAudit(c,'connection.saved',{type:'connection'},{connection:'sms'});return c.json(await c.get('services').connections.smsStatus())})
 app.delete(path,emptyMutationBody,async c=>{await requireConnectionOwner(c);await c.get('services').connections.remove('sms');await recordOperatorAudit(c,'connection.removed',{type:'connection'},{connection:'sms'});return c.json(await c.get('services').connections.smsStatus())})
 app.post('/api/public/sms/twilio/status',bodyLimit({maxSize:8192,onError:c=>c.json({error:'VALIDATION_ERROR',message:'The SMS callback is too large.'},413)}),async c=>{await c.get('services').sms.status(c.req.raw);return c.body(null,204,{'Cache-Control':'no-store'})})
 app.post('/api/public/sms/twilio',bodyLimit({maxSize:8192,onError:c=>c.json({error:'VALIDATION_ERROR',message:'The SMS callback is too large.'},413)}),async c=>c.body(await c.get('services').sms.inbound(c.req.raw),200,{'Content-Type':'text/xml; charset=utf-8','Cache-Control':'no-store'}))
}
