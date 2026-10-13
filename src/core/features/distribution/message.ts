function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

/** Participant invitations use workspace and revision metadata from the claim. */
export function participantInvitation(business: string, title: string, link: string, optOut: string) {
  return {
    subject: `${business}: ${title}`,
    text: `${business} invites your feedback on ${title}.\n${link}\n\nStop future flow mail: ${optOut}`,
    html: `<!doctype html><html lang="en"><body><p>${escapeHtml(business)} invites your feedback on ${escapeHtml(title)}.</p><p><a href="${escapeHtml(link)}">Open the form</a></p><p><a href="${escapeHtml(optOut)}">Stop future flow mail</a></p></body></html>`,
  }
}
