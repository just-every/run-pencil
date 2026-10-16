import { validateLogo } from '../brand'
import { buttonTextColor, type NotificationBrand } from '../notifications'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

/** Participant invitations use workspace and revision metadata from the claim. */
export function participantInvitation(brand: NotificationBrand, title: string, link: string, optOut: string) {
  const business = brand.businessName
  const foreground = buttonTextColor(brand.accentColor)
  let attachment
  if (brand.logo) {
    validateLogo(brand.logo.content, brand.logo.contentType)
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[brand.logo.contentType]
    attachment = { filename: `business-logo.${extension}`, contentType: brand.logo.contentType, content: brand.logo.content, disposition: 'inline' as const, contentId: 'business-logo@pencil' }
  }
  const header = (value: string) => value.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 180)
  return {
    ...(attachment ? { attachments: [attachment] } : {}),
    subject: `${header(business)}: ${header(title)}`,
    text: `${business}\n${brand.supportingLine ? `${brand.supportingLine}\n` : ''}${business} invites your feedback on ${title}.\n${link}\n\nStop future flow mail: ${optOut}`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f7f7f5;color:#202720;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:24px;background:#fff;overflow-wrap:anywhere">${attachment ? `<img src="cid:${attachment.contentId}" alt="${escapeHtml(business)}" style="display:block;max-width:160px;max-height:80px" />` : ''}<p dir="auto">${escapeHtml(business)}</p>${brand.supportingLine ? `<p dir="auto">${escapeHtml(brand.supportingLine)}</p>` : ''}<h1 style="font-size:24px" dir="auto">${escapeHtml(business)} invites your feedback on ${escapeHtml(title)}.</h1><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 20px;background:${brand.accentColor};color:${foreground};text-decoration:underline;border-radius:6px">Open the form</a></p><p><a href="${escapeHtml(optOut)}">Stop future flow mail</a></p></main></body></html>`,
  }
}
