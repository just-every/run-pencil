export type ReminderKind = 'before' | 'on_date' | 'overdue'
export type ReminderDate = { kind: ReminderKind; dueDate: string }
const day = 86_400_000
export function calendarOffset(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * day).toISOString().slice(0, 10)
}
export function reminderDates(reviewDate: string, today: string, createdDate: string, lastOverdue?: string | null): ReminderDate[] {
  const dates: ReminderDate[] = []
  // A newly created action inside the lead period still receives the before reminder.
  if (createdDate < reviewDate && calendarOffset(reviewDate, -3) <= today) dates.push({ kind: 'before', dueDate: calendarOffset(reviewDate, -3) })
  if (createdDate <= reviewDate && reviewDate <= today) dates.push({ kind: 'on_date', dueDate: reviewDate })
  const weeksSinceCreation = Math.max(1, Math.ceil((Date.parse(createdDate) - Date.parse(reviewDate)) / (7 * day)))
  let dueDate = lastOverdue ? calendarOffset(lastOverdue, 7) : calendarOffset(reviewDate, weeksSinceCreation * 7)
  // Bounded catch-up: later ticks retain and continue any older outstanding weeks.
  for (let count = 0; dueDate <= today && count < 100; count++, dueDate = calendarOffset(dueDate, 7)) dates.push({ kind: 'overdue', dueDate })
  return dates
}
export function nextReminderDate(reviewDate: string, today: string, recorded: ReminderDate[] = []) {
  const has = (kind: ReminderKind, dueDate: string) => recorded.some(row => row.kind === kind && row.dueDate === dueDate)
  const before = calendarOffset(reviewDate, -3)
  if (today < reviewDate && !has('before',before)) return today < before ? before : today
  if (today <= reviewDate && !has('on_date',reviewDate)) return reviewDate
  let next = calendarOffset(reviewDate, Math.max(1, Math.ceil((Date.parse(today) - Date.parse(reviewDate)) / (7 * day))) * 7)
  while (has('overdue',next)) next = calendarOffset(next,7)
  return next
}
