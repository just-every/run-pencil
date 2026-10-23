import type { PrefilledAnswer } from '../../shared/knownDataPrefill'
import { ValidationError } from '../../shared/errors'

type Claim={participantId:string;revisionId:string;answers:Record<string,PrefilledAnswer>}
const key=(secret:string)=>crypto.subtle.importKey('raw',new TextEncoder().encode(`pencil-prefill:${secret}`),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
/** Returned in the invitation document and posted in the body; never stored or put in a URL. */
export async function issuePrefillProof(secret:string,claim:Claim) {
  const body=Buffer.from(JSON.stringify(claim)).toString('base64url')
  const signature=await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(body))
  return `${body}.${Buffer.from(signature).toString('base64url')}`
}
export async function readPrefillProof(secret:string,proof:string,participantId:string,revisionId:string) {
  try {
    const [body,signature,extra]=proof.split('.')
    if(!body||!signature||extra||!await crypto.subtle.verify('HMAC',await key(secret),Buffer.from(signature,'base64url'),new TextEncoder().encode(body)))throw new Error()
    const claim=JSON.parse(Buffer.from(body,'base64url').toString('utf8')) as Claim
    if(claim.participantId!==participantId||claim.revisionId!==revisionId)throw new Error()
    return claim.answers
  } catch { throw new ValidationError('The prefilled answers could not be verified. Reload the invitation before submitting.') }
}
