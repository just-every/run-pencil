import type { emailFirstQuestion } from '../../shared/emailFirstQuestion'
import { validateLogo } from '../brand'
import { buttonTextColor, type NotificationBrand } from '../notifications'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

/** Participant invitations use workspace and revision metadata from the claim. */
export function participantInvitation(brand: NotificationBrand, title: string, link: string, optOut: string, embedded?: ReturnType<typeof emailFirstQuestion>) {
  const business = brand.businessName
  const foreground = buttonTextColor(brand.accentColor)
  let attachment
  if (brand.logo) {
    validateLogo(brand.logo.content, brand.logo.contentType)
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[brand.logo.contentType]
    attachment = { filename: `business-logo.${extension}`, contentType: brand.logo.contentType, content: brand.logo.content, disposition: 'inline' as const, contentId: 'business-logo@pencil' }
  }
  const header = (value: string) => value.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 180)
  const options = embedded?.options.map(option => {
    const target = new URL(link)
    target.searchParams.set('__pencil_first', option.value)
    return { ...option, link: target.href }
  }) ?? []
  const embeddedText = embedded && options.length ? `\n${embedded.prompt}\n${options.map(option => `${option.label}: ${option.link}`).join('\n')}\n` : ''
  const embeddedHtml = embedded && options.length ? `<h2 id="first-question" style="font-size:20px" dir="auto">${escapeHtml(embedded.prompt)}</h2><div role="group" aria-labelledby="first-question">${options.map(option => `<a href="${escapeHtml(option.link)}" aria-label="${escapeHtml(`${embedded.prompt}: ${option.label}`)}" style="display:inline-block;margin:4px;padding:12px 16px;background:${brand.accentColor};color:${foreground};text-decoration:underline;border-radius:6px">${escapeHtml(option.label)}</a>`).join('')}</div>` : ''
  return {
    ...(attachment ? { attachments: [attachment] } : {}),
    subject: `${header(business)}: ${header(title)}`,
    text: `${business}\n${brand.supportingLine ? `${brand.supportingLine}\n` : ''}${business} invites your feedback on ${title}.\n${embeddedText}${link}\n\nStop future flow mail: ${optOut}`,
    html: `<!doctype html><html lang="en"><head><title>${escapeHtml(business)}: ${escapeHtml(title)}</title></head><body style="margin:0;background:#f7f7f5;color:#202720;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:24px;background:#fff;overflow-wrap:anywhere">${attachment ? `<img src="cid:${attachment.contentId}" alt="${escapeHtml(business)}" style="display:block;max-width:160px;max-height:80px" />` : ''}<p dir="auto">${escapeHtml(business)}</p>${brand.supportingLine ? `<p dir="auto">${escapeHtml(brand.supportingLine)}</p>` : ''}<h1 style="font-size:24px" dir="auto">${escapeHtml(business)} invites your feedback on ${escapeHtml(title)}.</h1>${embeddedHtml}<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 20px;background:${brand.accentColor};color:${foreground};text-decoration:underline;border-radius:6px">Open the form</a></p><p><a href="${escapeHtml(optOut)}">Stop future flow mail</a></p></main></body></html>`,
  }
}
