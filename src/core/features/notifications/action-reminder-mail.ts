import type { ReminderKind } from '../actions/reminder-schedule'
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const timing = { before: 'Your action review is coming up', on_date: 'Your action is due for review', overdue: 'Your action is overdue for review' }
export function composeActionReminder(input: { title: string; reviewDate: string; kind: ReminderKind; actionId: string; origin: string; timeZone: string }) {
  const url = new URL(`/app/actions/${encodeURIComponent(input.actionId)}`, input.origin)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid action reminder origin.')
  const heading = timing[input.kind]
  const text = `${heading}: ${input.title}\nReview date: ${input.reviewDate} (${input.timeZone}).\n\nSign in to review the action and record your verdict: ${url.href}\nPencil never decides whether the action worked.\n\nThis is an automated reminder. Replies are not monitored.`
  return { subject: `${heading}: ${input.title.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 160)}`, text,
    html: `<html><body><h1>${escape(heading)}</h1><p dir="auto">${escape(input.title)}</p><p>Review date: ${escape(input.reviewDate)} (${escape(input.timeZone)}).</p><p><a href="${escape(url.href)}">Sign in to review the action and record your verdict</a></p><p>Pencil never decides whether the action worked.</p><p>This is an automated reminder. Replies are not monitored.</p></body></html>`,
    headers: { 'Auto-Submitted': 'auto-generated' } }
}
