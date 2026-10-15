import type { DevelopmentCaptureClaim } from './captured-mail.server'
import { digestEligibility, digestLiveCount } from '../../src/core/features/notifications/digest-eligibility'
export const digestCaptureClaim:DevelopmentCaptureClaim=message=>({sql:`EXISTS(SELECT 1 FROM digest_deliveries d JOIN digest_preferences p ON p.flow_id=d.flow_id AND p.operator_id=d.operator_id JOIN operators o ON o.id=d.operator_id
 WHERE d.idempotency_key=? AND d.status='sending' AND lower(o.email)=lower(?) AND d.attempts=? AND ${digestEligibility} AND ${digestLiveCount}>0 AND ${digestLiveCount}=CAST(? AS INTEGER)
 AND EXISTS(SELECT 1 FROM digest_attempts a WHERE a.id=? AND a.delivery_id=d.id AND a.ordinal=d.attempts AND a.event='started'))`,bindings:[message.deliveryId,message.to.length===1?message.to[0]:'',message.headers?.['X-Pencil-Digest-Attempt']??'',message.headers?.['X-Pencil-Digest-Count']??'',message.headers?.['X-Pencil-Digest-Claim']??'']})
