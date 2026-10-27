export function smsRefusal(code: number | null) {
  if (!code) return null
  const kind = code === 21610 ? 'opted-out' : [21211, 21612, 21614].includes(code) ? 'recipient-number' : [21212, 20003, 21408].includes(code) ? 'sender-settings' : 'provider'
  return { code, kind }
}
export function smsRefusalReason(code: number) {
  switch (smsRefusal(code)!.kind) {
    case 'opted-out': return `The contact opted out of texts from your Twilio number (error ${code}). Only they can opt back in, by replying START to that number.`
    case 'recipient-number': return `Twilio refused the contact's number (error ${code}). Edit the number and record consent for the corrected number before queuing a retry.`
    case 'sender-settings': return `Twilio refused the sending number, credentials or country permission (error ${code}). Fix it in Settings or Twilio, then queue a retry.`
    default: return `Twilio refused the message (error ${code}). Look up the code in Twilio's error list, fix it in Settings or your Twilio account, then queue a retry.`
  }
}
export function deliveryRetryAction(row: { status: string; channel: string; refusalCode: number | null; mobile: string | null; currentMobile: string | null; smsConsented: number }) {
  if (!['failed', 'unknown'].includes(row.status)) return 'none'
  if (row.channel !== 'sms') return 'retry'
  const refusal = smsRefusal(row.refusalCode)
  if (refusal?.kind === 'opted-out') return 'none'
  if (refusal?.kind === 'recipient-number' && (!row.smsConsented || row.mobile === row.currentMobile)) return 'edit-number'
  return 'retry'
}
