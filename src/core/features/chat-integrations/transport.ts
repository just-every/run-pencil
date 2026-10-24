import type { IntegrationConnections } from '../../platform/config/connections'
import type { ChatPlatform } from './model'
export type ChatMessage={text:string;link:string;buttonDeliveryId?:string;owner?:{id:string;name:string};channel?:string}
export type ChatOutcome={state:'confirmed'|'failed'|'unknown';httpStatus:number|null;reason:string|null}
const plain=(text:string)=>text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').slice(0,12000)
const teamsText=(text:string)=>plain(text).replace(/[&<>]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[character]!)
export async function postChat(connections:IntegrationConnections,platform:ChatPlatform,message:ChatMessage,key:string):Promise<ChatOutcome> {
  const slack=platform==='slack'?await connections.slack():undefined,teams=platform==='teams'?await connections.teams():undefined
  if(!slack&&!teams)return {state:'failed',httpStatus:null,reason:'The owner must reconnect this chat service.'}
  let response:Response
  try {
    const owner=message.owner
    const payload=slack?{channel:message.channel,text:plain(message.text)+'\n'+message.link,mrkdwn:false,unfurl_links:false,unfurl_media:false,
      blocks:[{type:'section',text:{type:'plain_text',text:plain(message.text)}},{type:'actions',elements:[{type:'button',text:{type:'plain_text',text:'Open in Pencil'},url:message.link},...(message.buttonDeliveryId?[{type:'button',text:{type:'plain_text',text:'Create action'},action_id:'pencil_create_action',value:message.buttonDeliveryId}]:[])]}]}:
      {type:'message',attachments:[{contentType:'application/vnd.microsoft.card.adaptive',contentUrl:null,content:{$schema:'http://adaptivecards.io/schemas/adaptive-card.json',type:'AdaptiveCard',version:'1.4',body:[...(owner?[{type:'TextBlock',text:`For <at>${teamsText(owner.name)}</at>`,wrap:true}]:[]),{type:'TextBlock',text:teamsText(message.text),wrap:true}],actions:[{type:'Action.OpenUrl',title:'Open in Pencil',url:message.link}],...(owner?{msteams:{entities:[{type:'mention',text:`<at>${teamsText(owner.name)}</at>`,mentioned:{id:owner.id,name:owner.name}}]}}:{})}}]}
    response=await fetch(slack?`${slack.apiOrigin.replace(/\/$/,'')}/chat.postMessage`:teams!.webhookUrl,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json','idempotency-key':key,...(slack?{authorization:`Bearer ${slack.botToken}`}:{})},body:JSON.stringify(payload)})
  } catch {return {state:'unknown',httpStatus:null,reason:'The chat service may have accepted this post. Automatic resend is disabled.'}}
  const status=response.status
  if(status<200||status>=300){await response.body?.cancel();return {state:'failed',httpStatus:status,reason:`Chat service returned HTTP ${status}.`}}
  if(!slack){await response.body?.cancel();return {state:'confirmed',httpStatus:status,reason:null}}
  try {
    const declared=Number(response.headers.get('content-length')??0)
    if(declared>16384){await response.body?.cancel();return {state:'unknown',httpStatus:status,reason:'Chat service returned an oversized receipt.'}}
    const reader=response.body?.getReader();if(!reader)throw new Error()
    let content='',size=0;const decoder=new TextDecoder()
    while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>16384){await reader.cancel();return {state:'unknown',httpStatus:status,reason:'Chat service returned an oversized receipt.'}}content+=decoder.decode(chunk.value,{stream:true})}
    content+=decoder.decode()
    const body=JSON.parse(content) as {ok?:unknown}
    return body.ok===true?{state:'confirmed',httpStatus:status,reason:null}:{state:'failed',httpStatus:status,reason:'Slack did not confirm the post. Check the bot permission and destination.'}
  } catch {return {state:'unknown',httpStatus:status,reason:'Chat service returned an invalid receipt; automatic resend is disabled.'}}
}
