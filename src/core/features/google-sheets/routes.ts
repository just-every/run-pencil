import { recordOperatorAudit } from '../audit'
import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { requireConnectionOwner } from '../../app/connection-owner'
import { googleConnectionSchema } from '../../platform/config/connections'
import { emptyMutationBody,resourceId,validateInput } from '../../shared/validation'
export function registerGoogleRoutes(app:Hono<WorkerEnvironment>){
 const base='/api/app/connections/google'
 app.get(base,async c=>c.json(await c.get('services').connections.googleStatus()))
 app.post(base+'/start',validateInput('json',googleConnectionSchema),async c=>{await requireConnectionOwner(c);const session=c.get('operatorSession');return c.json(await c.get('services').googleOAuth.start(c.req.valid('json'),session.operatorId,session.workspaceId))})
 app.get(base+'/callback',validateInput('query',z.object({state:z.string().min(20).max(200),code:z.string().min(1).max(4096)})),async c=>{await requireConnectionOwner(c);const session=c.get('operatorSession'),{state,code}=c.req.valid('query');await c.get('services').googleOAuth.callback(state,code,session.operatorId,session.workspaceId);await recordOperatorAudit(c,'connection.saved',{type:'connection'},{connection:'google'});return c.redirect('/app/settings?google=connected',303)})
 app.delete(base,emptyMutationBody,async c=>{await requireConnectionOwner(c);await c.get('services').connections.remove('google');await recordOperatorAudit(c,'connection.removed',{type:'connection'},{connection:'google'});return c.json(await c.get('services').connections.googleStatus())})
 app.get(base+'/worksheets',validateInput('query',z.object({spreadsheetId:z.string().regex(/^[A-Za-z0-9_-]{1,200}$/)})),async c=>c.json({worksheets:await c.get('services').sheets.tabs(c.req.valid('query').spreadsheetId)}))
 const form='/api/app/flows/:flowId/google-sheet',param=validateInput('param',z.object({flowId:resourceId}))
 app.get(form,param,async c=>c.json({link:await c.get('services').sheets.get(c.get('operatorSession').workspaceId,c.req.valid('param').flowId)}))
 app.put(form,param,validateInput('json',z.object({spreadsheetId:z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),tab:z.string().min(1).max(100)}).strict()),async c=>{const {spreadsheetId,tab}=c.req.valid('json');return c.json({link:await c.get('services').sheets.attach(c.get('operatorSession').workspaceId,c.req.valid('param').flowId,spreadsheetId,tab)})})
 app.post(form+'/sync',param,emptyMutationBody,async c=>{const session=c.get('operatorSession'),flowId=c.req.valid('param').flowId;await c.get('services').sheets.get(session.workspaceId,flowId);return c.json(await c.get('services').sheets.run(session.workspaceId,flowId))})
 app.post('/api/app/google-sheet/deliveries/:id/replay',validateInput('param',z.object({id:resourceId})),emptyMutationBody,async c=>{await c.get('services').sheets.replay(c.get('operatorSession').workspaceId,c.req.valid('param').id);return c.json({replayed:true})})
}
