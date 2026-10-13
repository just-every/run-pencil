import { expect } from 'vitest'

type Row = Record<string, unknown>
type Recipient = { outbox_id: string; response_id: string; operator_id: string; workspace_id: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const byId = (left: Row, right: Row) => String(left.id).localeCompare(String(right.id))

export async function scheduledNotificationPrestate(db: D1Database, now: string, outbox: Row[], responses: Row[]) {
  const [preferenceRows, operatorRows, linkRows, authorityRows] = await db.batch([
    db.prepare('SELECT * FROM notification_preferences ORDER BY flow_id,operator_id'),
    db.prepare('SELECT id,workspace_id FROM operators ORDER BY id'),
    db.prepare('SELECT operator_id,auth_id FROM operator_auth_links ORDER BY operator_id'),
    db.prepare('SELECT id,status FROM oa_operators ORDER BY id'),
  ])
  const preferences = preferenceRows.results
  const expectedCommands = outbox.filter(command => command.notification_eligible === 1
    && command.kind === 'response.completed' && command.status === 'pending'
    && typeof command.available_at === 'string' && command.available_at <= now
    && responses.some(response => response.id === command.response_id && response.notification_eligible === 1
      && response.state === 'released' && ['direct','embed','invitation'].some(source => source === response.source)))
  const ids = expectedCommands.map(command => String(command.id)).sort()
  const eligible = (await db.prepare(`SELECT x.id FROM response_outbox x JOIN responses r ON r.id=x.response_id
    WHERE x.notification_eligible=1 AND r.notification_eligible=1 AND r.state='released'
      AND r.source IN ('direct','embed','invitation') AND x.kind='response.completed'
      AND x.status='pending' AND x.available_at<=? ORDER BY x.id`).bind(now).all<{ id: string }>()).results
  expect(eligible.map(row => row.id)).toEqual(ids)
  const queriedRecipients = (await db.prepare(`SELECT DISTINCT x.id outbox_id,r.id response_id,r.workspace_id,p.operator_id
    FROM response_outbox x JOIN responses r ON r.id=x.response_id
    JOIN json_each(CASE WHEN json_valid(x.payload_json) THEN x.payload_json ELSE '{}' END,'$.notificationOperatorIds') recipient
    JOIN notification_preferences p ON p.flow_id=r.flow_id AND p.operator_id=recipient.value
    JOIN operators o ON o.id=p.operator_id AND o.workspace_id=r.workspace_id
    WHERE x.id IN (SELECT value FROM json_each(?)) AND recipient.type='text' AND p.mode='immediately'
      AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators a ON a.id=l.auth_id WHERE l.operator_id=p.operator_id AND a.status='inactive')
    ORDER BY x.id,p.operator_id`).bind(JSON.stringify(ids)).all<Recipient>()).results
  const recipients: Recipient[] = []
  for (const id of ids) {
    const commands = outbox.filter(row => row.id === id)
    expect(commands).toHaveLength(1)
    const command = commands[0], matching = responses.filter(row => row.id === command.response_id)
    expect(matching).toHaveLength(1)
    expect(command).toMatchObject({ notification_eligible: 1, kind: 'response.completed', status: 'pending' })
    expect(String(command.available_at) <= now).toBe(true)
    expect(matching[0]).toMatchObject({ notification_eligible: 1, state: 'released' })
    expect(['direct','embed','invitation']).toContain(matching[0].source)
    const captured = JSON.parse(String(command.payload_json)).notificationOperatorIds
    expect(Array.isArray(captured)).toBe(true)
    const capturedIds = new Set(captured.filter((value: unknown): value is string => typeof value === 'string'))
    for (const preference of preferences) {
      if (preference.flow_id !== matching[0].flow_id || preference.mode !== 'immediately'
        || !capturedIds.has(String(preference.operator_id))) continue
      const inWorkspace = operatorRows.results.some(operator => operator.id === preference.operator_id && operator.workspace_id === matching[0].workspace_id)
      const inactive = linkRows.results.some(link => link.operator_id === preference.operator_id
        && authorityRows.results.some(authority => authority.id === link.auth_id && authority.status === 'inactive'))
      if (inWorkspace && !inactive) recipients.push({ outbox_id: id, response_id: String(matching[0].id),
        operator_id: String(preference.operator_id), workspace_id: String(matching[0].workspace_id) })
    }
    for (const recipient of recipients.filter(row => row.outbox_id === id)) {
      expect(recipient.response_id).toBe(command.response_id)
      expect(recipient.workspace_id).toBe(matching[0].workspace_id)
      expect(captured).toContain(recipient.operator_id)
    }
  }
  recipients.sort((left, right) => left.outbox_id < right.outbox_id ? -1 : left.outbox_id > right.outbox_id ? 1
    : left.operator_id < right.operator_id ? -1 : left.operator_id > right.operator_id ? 1 : 0)
  expect(queriedRecipients).toEqual(recipients)
  const attempts = (await db.prepare('SELECT * FROM notification_attempts ORDER BY id').all()).results
  return { ids, recipients, attempts, preferences, responses }
}

export async function assertScheduledNotificationEffects(db: D1Database, now: string,
  before: Awaited<ReturnType<typeof scheduledNotificationPrestate>>, addedAudit: Row[]) {
  const deliveries = (await db.prepare('SELECT * FROM notification_deliveries ORDER BY id').all()).results
  expect(deliveries).toHaveLength(before.recipients.length)
  expect(deliveries.map(row => `${row.response_id}:${row.operator_id}`).sort())
    .toEqual(before.recipients.map(row => `${row.response_id}:${row.operator_id}`).sort())
  expect(new Set(deliveries.map(row => row.idempotency_key)).size).toBe(deliveries.length)
  const attempts = (await db.prepare('SELECT * FROM notification_attempts ORDER BY id').all()).results
  const addedAttempts = attempts.filter(row => !before.attempts.some(old => old.id === row.id))
  expect(addedAttempts).toHaveLength(deliveries.length * 2)
  for (const delivery of deliveries) {
    expect(delivery.id).toMatch(/^[0-9a-f]{32}$/)
    expect(delivery.idempotency_key).toMatch(/^[0-9a-f]{64}$/)
    expect(delivery).toEqual({ id: delivery.id, response_id: delivery.response_id, operator_id: delivery.operator_id,
      idempotency_key: delivery.idempotency_key, status: 'sent', attempts: 1, explicit_retry_authorized: 0,
      first_attempt_at: now, last_attempt_at: now, available_at: now, reason: null,
      provider_id: null, provider: 'development', provider_code: null, created_at: now, updated_at: now })
    const events = addedAttempts.filter(row => row.delivery_id === delivery.id).sort((left, right) => String(left.event).localeCompare(String(right.event)))
    expect(events).toHaveLength(2)
    expect(events[0].id).toMatch(uuid)
    expect(String(events[1].id).slice(0, 36)).toMatch(uuid)
    expect(events[1].id).toBe(`${String(events[1].id).slice(0, 36)}:${delivery.id}`)
    expect(events).toEqual([
      { id: events[0].id, delivery_id: delivery.id, ordinal: 1, event: 'sent', provider: 'development', provider_code: null, created_at: now },
      { id: events[1].id, delivery_id: delivery.id, ordinal: 1, event: 'started', provider: null, provider_code: null, created_at: now },
    ])
  }
  expect(attempts).toEqual([...before.attempts, ...addedAttempts].sort(byId))
  expect(addedAudit).toHaveLength(before.recipients.length)
  expect(addedAudit.map(row => row.workspace_id).sort()).toEqual(before.recipients.map(row => row.workspace_id).sort())
  for (const row of addedAudit) {
    expect(row.id).toMatch(uuid)
    expect(row).toEqual({ id: row.id, workspace_id: row.workspace_id, kind: 'notification.delivery',
      actor_operator_id: null, subject_type: 'notification', subject_id: null,
      details_json: JSON.stringify({ status: 'sent' }), created_at: now })
  }
  const expectedPreferences = before.preferences.map(preference => before.recipients.some(recipient => recipient.operator_id === preference.operator_id
    && before.responses.some(response => response.id === recipient.response_id && response.flow_id === preference.flow_id))
    ? { ...preference, failure_reason: null } : preference)
  expect((await db.prepare('SELECT * FROM notification_preferences ORDER BY flow_id,operator_id').all()).results).toEqual(expectedPreferences)
}
