import type { NotificationLogo } from './brand.server'
import { validateLogo } from '../brand'
const logoExtensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const header = (value: string) => value.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 180)
export function buttonTextColor(accent: string) {
  if (!/^#[a-f\d]{6}$/i.test(accent)) throw new Error('Notification accent must be a six-digit hex color.')
  const [r,g,b] = [1,3,5].map(offset => { const v = parseInt(accent.slice(offset,offset+2),16)/255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4 })
  const luminance = .2126*r + .7152*g + .0722*b
  return (luminance+.05)/.05 >= 4.5 ? '#000000' : '#ffffff'
}
/** Only explicit public brand and notification fields cross the mail boundary. */
export function composeResponseNotification(input: { businessName: string; flowTitle: string; submittedAt: string; timeZone: string; resultsUrl: string; accentColor: string; supportingLine?: string; logo?: NotificationLogo }) {
  const url = new URL(input.resultsUrl)
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^\/app\/flows\/[^/]+\/results$/.test(url.pathname)) throw new Error('Notification links must use the authenticated results page.')
  const submitted = new Intl.DateTimeFormat('en', { timeZone: input.timeZone, dateStyle: 'medium', timeStyle: 'long' }).format(new Date(input.submittedAt))
  const title = header(input.flowTitle), business = header(input.businessName)
  const foreground = buttonTextColor(input.accentColor)
  const supportingLine = input.supportingLine ?? ''
  let attachment
  if (input.logo) {
    validateLogo(input.logo.content, input.logo.contentType)
    const extension = logoExtensions[input.logo.contentType]
    attachment = { filename: `business-logo.${extension}`, contentType: input.logo.contentType, content: input.logo.content, disposition: 'inline' as const, contentId: 'business-logo@pencil' }
  }
  return {
    ...(attachment ? { attachments: [attachment] } : {}),
    subject: `${business}: new response to ${title}`,
    text: `${input.businessName}\n${supportingLine ? `${supportingLine}\n` : ''}New response to ${input.flowTitle}\nSubmitted ${submitted} (${input.timeZone}).\n\nSign in to view results: ${url.href}\n\nThis is an automated notification. Replies are not monitored.`,
    html: `<!doctype html><html><body style="margin:0;background:#f7f7f5;color:#202720;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:24px;background:#fff;overflow-wrap:anywhere">${attachment ? `<img src="cid:${attachment.contentId}" alt="${escape(input.businessName)}" style="display:block;max-width:160px;max-height:80px" />` : ''}<p dir="auto">${escape(input.businessName)}</p>${supportingLine ? `<p dir="auto">${escape(supportingLine)}</p>` : ''}<h1 style="font-size:24px" dir="auto">New response to ${escape(input.flowTitle)}</h1><p>Submitted ${escape(submitted)} (${escape(input.timeZone)}).</p><p><a href="${escape(url.href)}" style="display:inline-block;padding:14px 20px;background:${input.accentColor};color:${foreground};text-decoration:underline;border-radius:6px">Sign in to view results</a></p><p style="font-size:14px">This is an automated notification. Replies are not monitored.</p></main></body></html>`,
    headers: { 'Auto-Submitted': 'auto-generated' },
  }
}
export function notificationSenderError(from: string) {
  return from.length <= 254 && /^(?:noreply|no-reply)@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(from) ? null : 'Response notification email is off: the verified sender (MAIL_FROM) must be a plain noreply@ or no-reply@ address. Sign-in email still works. Change the sender in this installation\'s setup to turn notifications on.'
}
