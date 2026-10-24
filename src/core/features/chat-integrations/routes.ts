import type { Hono } from 'hono'
import { z } from 'zod'
import { requireConnectionOwner } from '../../app/connection-owner'
import type { WorkerEnvironment } from '../../app/environment'
import { ValidationError } from '../../shared/errors'
import { emptyMutationBody, resourceId, validateInput } from '../../shared/validation'
import { recordOperatorAudit } from '../audit'
import { chatFormSchema, chatPlatforms, slackConnectionSchema, teamsConnectionSchema } from './model'

async function interactionBody(request:Request) {
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new ValidationError('Slack interactions require a signed form body.')
  const reader=request.body?.getReader();if(!reader)throw new ValidationError('A signed Slack interaction is required.')
  let size=0,body='';const decoder=new TextDecoder()
  while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>32768){await reader.cancel();throw new ValidationError('Slack interaction is too large.')}body+=decoder.decode(chunk.value,{stream:true})}
  return body+decoder.decode()
}
export function registerChatRoutes(app:Hono<WorkerEnvironment>){
  app.get('/api/app/connections/slack',async c=>{await requireConnectionOwner(c);return c.json(await c.get('services').connections.slackStatus())})
  app.put('/api/app/connections/slack',validateInput('json',slackConnectionSchema),async c=>{await requireConnectionOwner(c);await c.get('services').connections.saveSlack(c.req.valid('json'));await c.get('services').chat.disarm('slack');await recordOperatorAudit(c,'connection.saved',{type:'connection'},{connection:'slack'});return c.json(await c.get('services').connections.slackStatus())})
  app.get('/api/app/connections/teams',async c=>{await requireConnectionOwner(c);return c.json(await c.get('services').connections.teamsStatus())})
  app.put('/api/app/connections/teams',validateInput('json',teamsConnectionSchema),async c=>{await requireConnectionOwner(c);await c.get('services').connections.saveTeams(c.req.valid('json'));await c.get('services').chat.disarm('teams');await recordOperatorAudit(c,'connection.saved',{type:'connection'},{connection:'teams'});return c.json(await c.get('services').connections.teamsStatus())})
  for(const platform of chatPlatforms)app.delete(`/api/app/connections/${platform}`,emptyMutationBody,async c=>{await requireConnectionOwner(c);await c.get('services').chat.disarm(platform);await c.get('services').connections.remove(platform);await recordOperatorAudit(c,'connection.removed',{type:'connection'},{connection:platform});return c.json({saved:false})})
  const base='/api/app/flows/:flowId/chat',param=validateInput('param',z.object({flowId:resourceId}))
  app.get(base,param,async c=>c.json({links:await c.get('services').chat.list(c.get('operatorSession').workspaceId,c.req.valid('param').flowId)}))
  app.put(base,param,validateInput('json',chatFormSchema),async c=>c.json({links:await c.get('services').chat.save(c.get('operatorSession').workspaceId,c.req.valid('param').flowId,c.req.valid('json'))}))
  app.delete(base+'/:platform',validateInput('param',z.object({flowId:resourceId,platform:z.enum(chatPlatforms)})),emptyMutationBody,async c=>{await c.get('services').chat.remove(c.get('operatorSession').workspaceId,c.req.valid('param').flowId,c.req.valid('param').platform);return c.body(null,204)})
  app.post('/api/public/chat/slack/interactions',async c=>{
    const result=await c.get('services').chat.interaction({body:await interactionBody(c.req.raw),timestamp:c.req.header('x-slack-request-timestamp')??null,signature:c.req.header('x-slack-signature')??null})
    return c.json({text:'Action created. Sign in to Pencil to review it.',actionId:result.actionId})
  })
}
