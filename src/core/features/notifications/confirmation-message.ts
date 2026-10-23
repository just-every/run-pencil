import { decodeLogo, encodeLogo } from '../brand'
import type { composeRespondentConfirmation } from './confirmation-compose'
type Message = ReturnType<typeof composeRespondentConfirmation>
/** JSON must retain bytes across delayed dispatch and process restarts. */
export function serializeConfirmation(message: Message) {
 return JSON.stringify({...message,attachments:message.attachments?.map(attachment=>({...attachment,content:encodeLogo(attachment.content)}))})
}
export function deserializeConfirmation(json:string): Message {
 const value=JSON.parse(json)
 if (!value || typeof value.subject!=='string' || typeof value.text!=='string' || typeof value.html!=='string') throw new Error('Invalid stored confirmation.')
 return {subject:value.subject,text:value.text,html:value.html,...(value.attachments ? {attachments:value.attachments.map((attachment: {filename:string;contentType:string;content:string;disposition:'inline';contentId:string})=>({...attachment,content:decodeLogo(attachment.content)}))} : {})}
}
