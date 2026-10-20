import type { ActionReminders as ReminderState } from '../reminders'
const labels = { before: 'Before review', on_date: 'Review date', overdue: 'Weekly overdue' }
export function ActionReminders({ reminders }: { reminders: ReminderState }) {
  const failure = reminders.deliveries.find(delivery => delivery.status === 'failed' || delivery.status === 'unknown')
  return <section className="panel" style={{ padding: '1.25rem', minWidth: 0, overflowWrap: 'anywhere' }} aria-labelledby="action-reminders-title">
    <h2 id="action-reminders-title">Owner reminders</h2>
    <p>{reminders.explanation}</p>
    <p className="muted">Email only. Sending hours: {reminders.sendingWindowStart}–{reminders.sendingWindowEnd} ({reminders.timeZone}). Reminders due outside these hours wait until the next opening.</p>
    {reminders.nextDate ? <p>Next scheduled review reminder: {reminders.nextDate}. Pending mail may be held until sending hours open.</p> : null}
    {failure ? <p className="status-note" data-tone="error">Reminder for {failure.dueDate}: {failure.status}. {failure.reason}</p> : null}
    <p className="muted">Review reminders ask the owner to record a verdict. Pencil never sets one.</p>
    {reminders.deliveries.length ? <details><summary>Recent reminder delivery history</summary><ul style={{ paddingInlineStart: '1.25rem' }}>{reminders.deliveries.map(delivery => <li key={delivery.id} style={{ marginBlock: '.75rem' }}>
      <strong>{labels[delivery.kind]}</strong> · {delivery.dueDate} · {delivery.status === 'sent' && reminders.state === 'suppressed' ? 'suppressed locally' : delivery.status}
      {delivery.reason ? <p className="muted" style={{ marginBlock: '.25rem' }}>{delivery.reason}</p> : null}
      {delivery.status === 'failed' || delivery.status === 'unknown' ? <p className="muted" style={{ marginBlock: '.25rem' }}>This occurrence will not resend automatically. Future scheduled reminders continue while the action is unresolved.</p> : null}
    </li>)}</ul></details> : null}
  </section>
}
