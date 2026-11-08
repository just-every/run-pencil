import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker, { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import type { ActionReminders } from '../../src/core/features/actions/reminders'
import type { WorkerBindings } from '../../src/core/app/environment'
import { readHealth } from './action-health-scenario'
import { actionsHttp } from './actions-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
afterEach(() => { vi.useRealTimers() })

type Detail = { id: string; state: string; verdict: string | null; version: number; reviewDue: boolean; history: unknown[]; reminders: ActionReminders; measurements: Array<{ observedValue: number; unit: string; difference: number; direction: string; flowId: string; revisionId: string | null; operator: string }> }
const mailBindings = { MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'synthetic-action-reminder-key', MAIL_FROM: 'no-reply@example.test', APP_ORIGIN: 'https://forms.example.test', SEED_ADMIN_EMAIL: 'admin@example.test', SEED_SAMPLE_DATA: 'false' }
const scheduled = async (at: string) => {
  vi.setSystemTime(new Date(at))
  await worker.scheduled!({ scheduledTime: Date.parse(at), cron: '* * * * *', noRetry() {} } as ScheduledController, { ...env, ...mailBindings } as unknown as WorkerBindings, { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext)
}

contract(['ACT-005','ACT-009','WS-002','NOTIFY-004','AGENT-005'], 'ACT-009 emails the owner before, on and weekly after review exactly once within hours; only the operator verdict stops queued and future reminders', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-26T01:00:00.000Z'))
  const f = await actionsHttp()
  await f.respond('Too long', 'slow')
  await env.DB.prepare("UPDATE workspaces SET time_zone='Australia/Brisbane' WHERE id=?").bind(f.workspaceId).run()
  await env.DB.prepare('UPDATE oa_sessions SET expires_at=? WHERE id IN (?,?)').bind(Date.parse('2026-12-25T00:00:00Z'),f.lead.sessionId,f.owner.sessionId).run()
  const action = await f.create()
  const reminderMail: any[] = []
  const failureMode = new Map<string,'rate_limited'|'unknown'|'rejected'>()
  const send = vi.spyOn(globalThis,'fetch').mockImplementation(async (_url, options) => {
    const payload = JSON.parse(String(options?.body))
    if (JSON.stringify(payload).includes('/app/actions/')) {
      reminderMail.push(payload)
      const mode = failureMode.get(payload.subject.split(': ').slice(1).join(': '))
      if (mode === 'unknown') throw new Error('Synthetic ambiguous network edge')
      if (mode === 'rejected') return new Response(null,{status:400})
      if (mode === 'rate_limited') return new Response(null,{status:429})
    }
    return new Response(null, {status:202})
  })
  try {
    for (const to of ['in_progress', 'ready_for_review']) expect((await f.call(`/api/app/actions/${action.id}/transitions`, { to })).status).toBe(200)
    const read = async () => (await (await f.call(`/api/app/actions/${action.id}`)).json()) as Detail
    // 08:59 in Brisbane is still the previous UTC date: due work is queued and held.
    await scheduled('2026-11-27T22:59:00.000Z')
    expect(reminderMail).toHaveLength(0)
    expect((await read()).reminders).toMatchObject({state:'suppressed',channel:'email',timeZone:'Australia/Brisbane',deliveries:[{kind:'before',dueDate:'2026-11-28',status:'pending',attempts:0}]})
    for (const at of ['2026-11-27T23:00:00.000Z','2026-11-30T23:00:00.000Z','2026-12-07T23:00:00.000Z']) {
      await Promise.all([scheduled(at), scheduled(at)])
      await scheduled(at)
    }
    expect(reminderMail).toHaveLength(3)
    expect(reminderMail.map(mail=>mail.subject)).toEqual([
      expect.stringContaining('review is coming up'),expect.stringContaining('due for review'),expect.stringContaining('overdue for review'),
    ])
    const owner = await env.DB.prepare('SELECT email FROM operators WHERE id=?').bind(f.owner.operatorId).first<{email:string}>()
    expect(reminderMail.every(mail=>mail.personalizations[0].to[0].email===owner!.email)).toBe(true)
    expect(reminderMail.every(mail=>mail.from.email==='no-reply@example.test' && mail.headers['Auto-Submitted']==='auto-generated')).toBe(true)
    expect(JSON.stringify(reminderMail)).not.toContain('Too long')
    expect(new Set(reminderMail.map(mail=>mail.custom_args.rer_delivery_id)).size).toBe(3)
    expect((await read()).reminders.deliveries).toMatchObject([{kind:'overdue',dueDate:'2026-12-08',status:'sent',attempts:1},{kind:'on_date',dueDate:'2026-12-01',status:'sent',attempts:1},{kind:'before',dueDate:'2026-11-28',status:'sent',attempts:1}])
    expect(await read()).toMatchObject({state:'ready_for_review',verdict:null})
    // A second weekly occurrence is queued outside hours, then the owner's verdict cancels it atomically.
    await scheduled('2026-12-14T22:59:00.000Z')
    expect((await read()).reminders.deliveries[0]).toMatchObject({kind:'overdue',dueDate:'2026-12-15',status:'pending'})
    const later = { flowId: f.flowId, revisionId: f.revisionId, observedValue: 52, observedAt: '2026-11-20T09:00:00Z' }
    const refused = await f.call(`/api/app/actions/${action.id}/measurements`, { ...later, unit: 'responses' })
    expect(refused.status).toBe(400)
    expect((await refused.json() as { message: string }).message).toBe('Record the observed value in percent, the unit of the baseline, so the two can be compared.')
    const recorded = await f.call(`/api/app/actions/${action.id}/measurements`, { ...later, unit: 'percent' })
    expect(recorded.status).toBe(201)
    const measured = await recorded.json() as Detail
    expect(measured.measurements).toEqual([expect.objectContaining({ flowId: f.flowId, revisionId: f.revisionId, observedValue: 52, unit: 'percent', difference: 19, direction: 'desired', operator: 'Lead operator' })])
    // Recording a value never decides the outcome.
    expect(measured).toMatchObject({ state: 'ready_for_review', verdict: null })
    expect((await f.as(f.owner.token)(`/api/app/actions/${action.id}/transitions`, { to: 'ineffective', note: 'Lunch queues are unchanged.' })).status).toBe(200)
    expect(await read()).toMatchObject({ state: 'ineffective', verdict: 'ineffective', reminders:{state:'stopped',deliveries:[{kind:'overdue',dueDate:'2026-12-15',status:'cancelled'},{},{},{}]} })
    await scheduled('2026-12-14T23:00:00.000Z'); await scheduled('2026-12-21T23:00:00.000Z')
    expect(reminderMail).toHaveLength(3)
    // Missing/departed owners never get mail, and the public detail honestly explains why.
    const noEmailOwner = await f.operator('Owner without email')
    const noEmailAction = await f.create({ownerOperatorId:noEmailOwner.operatorId,reviewDate:'2026-12-25'})
    await env.DB.prepare("UPDATE operators SET email='' WHERE id=?").bind(noEmailOwner.operatorId).run()
    const departedOwner = await f.operator('Departing owner')
    const departedAction = await f.create({ownerOperatorId:departedOwner.operatorId,reviewDate:'2026-12-25'})
    await f.services.auth.removeOperator({workspaceId:f.workspaceId,actorOperatorId:f.lead.operatorId,targetOperatorId:departedOwner.operatorId})
    await scheduled('2026-12-21T23:01:00.000Z')
    expect(reminderMail).toHaveLength(3)
    const missingEmail = await (await f.call(`/api/app/actions/${noEmailAction.id}`)).json() as Detail
    const departed = await (await f.call(`/api/app/actions/${departedAction.id}`)).json() as Detail
    expect(missingEmail.reminders).toMatchObject({state:'no_email',explanation:expect.stringContaining('no email address')})
    expect(departed.reminders).toMatchObject({state:'no_owner',explanation:expect.stringContaining('no current owner')})
    expect((await readHealth(f, noEmailAction.id)).reminders.schedule).toMatchObject({state:'no_email',repairPlan:[expect.stringContaining('correct the owner')]})
    expect((await readHealth(f, departedAction.id)).reminders.schedule).toMatchObject({actionId:departedAction.id,state:'no_owner'})
    const retryAction = await f.create({title:'Queued retry stops at verdict',reviewDate:'2026-12-25'})
    const unknownAction = await f.create({title:'Unknown mail never retries',reviewDate:'2026-12-25'})
    failureMode.set('Queued retry stops at verdict','rate_limited')
    failureMode.set('Unknown mail never retries','unknown')
    await scheduled('2026-12-21T23:02:00.000Z')
    expect(reminderMail).toHaveLength(5)
    const reminderDetail = async (id:string) => (await (await f.call(`/api/app/actions/${id}`)).json()) as Detail
    expect((await reminderDetail(retryAction.id)).reminders.deliveries[0]).toMatchObject({status:'pending',attempts:1})
    expect((await reminderDetail(unknownAction.id)).reminders.deliveries[0]).toMatchObject({status:'unknown',attempts:1})
    for (const to of ['in_progress','ready_for_review','effective']) expect((await f.as(f.owner.token)(`/api/app/actions/${retryAction.id}/transitions`,{to})).status).toBe(200)
    expect((await reminderDetail(retryAction.id)).reminders.deliveries[0]).toMatchObject({status:'cancelled',attempts:1})
    await scheduled('2026-12-21T23:03:00.000Z');await scheduled('2026-12-21T23:08:00.000Z')
    expect(reminderMail).toHaveLength(5)
    expect((await reminderDetail(unknownAction.id)).reminders.deliveries[0]).toMatchObject({status:'unknown',attempts:1})
    // A real permanent mail rejection and the retained unknown occurrence remain visible together with their native IDs.
    const rejectedAction = await f.create({title:'Rejected reminder retained in health',reviewDate:'2026-12-25'})
    failureMode.set('Rejected reminder retained in health','rejected')
    await scheduled('2026-12-21T23:09:00.000Z')
    expect(reminderMail).toHaveLength(6)
    const rejectedOccurrence = await env.DB.prepare("SELECT id FROM action_reminders WHERE action_id=? AND status='failed'").bind(rejectedAction.id).first<{id:string}>()
    const unknownOccurrence = await env.DB.prepare("SELECT id FROM action_reminders WHERE action_id=? AND status='unknown'").bind(unknownAction.id).first<{id:string}>()
    expect(rejectedOccurrence).not.toBeNull()
    expect(unknownOccurrence).not.toBeNull()
    // Retained history can exceed detail's thirty recent occurrences; health still includes the failure.
    await env.DB.batch(Array.from({length:31},(_,index)=>{
      const dueDate = new Date(Date.UTC(2027,0,index+1)).toISOString().slice(0,10)
      return env.DB.prepare("INSERT INTO action_reminders(id,action_id,operator_id,kind,due_date,review_date,status,idempotency_key,attempts,available_at,created_at,updated_at) VALUES(?,?,?,'overdue',?,'2026-12-25','sent',?,1,?,?,?)")
        .bind(crypto.randomUUID(),rejectedAction.id,f.owner.operatorId,dueDate,crypto.randomUUID(),'2027-02-01T00:00:00Z','2027-02-01T00:00:00Z','2027-02-01T00:00:00Z')
    }))
    expect((await reminderDetail(rejectedAction.id)).reminders.deliveries.some(item=>item.id===rejectedOccurrence!.id)).toBe(false)
    const beforeReads = send.mock.calls.length
    const rejectedHealth = await readHealth(f,rejectedAction.id)
    expect(rejectedHealth.reminders.occurrences).toEqual([expect.objectContaining({id:rejectedOccurrence!.id,status:'failed',attempts:1,repairPlan:[expect.stringContaining('cannot replay')]})])
    const unknownHealth = await readHealth(f,unknownAction.id)
    expect(unknownHealth.reminders.occurrences).toEqual([expect.objectContaining({id:unknownOccurrence!.id,status:'unknown',attempts:1,explanation:expect.stringContaining('may have arrived'),repairPlan:[expect.stringContaining('cannot resend')]})])
    expect(await readHealth(f,rejectedAction.id)).toEqual(rejectedHealth)
    expect(await readHealth(f,unknownAction.id)).toEqual(unknownHealth)
    const unavailable = createWorkerApp(undefined,createPencilPlatform(mailBindings.APP_ORIGIN,{...env,...mailBindings,MAIL_FROM:mailBindings.SEED_ADMIN_EMAIL} as unknown as WorkerBindings))
    const unavailableRead = await unavailable.request(`${mailBindings.APP_ORIGIN}/api/app/actions/${unknownAction.id}/health`,{headers:{Cookie:`__Host-operator_session=${f.lead.token}`}})
    expect(unavailableRead.status).toBe(200)
    const unavailableHealth = await unavailableRead.json() as Awaited<ReturnType<typeof readHealth>>
    expect(unavailableHealth.reminders.schedule).toMatchObject({actionId:unknownAction.id,state:'unavailable',explanation:expect.stringContaining('mail configuration'),repairPlan:[expect.stringContaining('installation owner')]})
    expect(unavailableHealth.reminders.occurrences).toEqual(unknownHealth.reminders.occurrences)
    expect(send.mock.calls).toHaveLength(beforeReads)
    await scheduled('2026-12-21T23:10:00.000Z')
    expect(reminderMail).toHaveLength(6)
    expect((await readHealth(f,unknownAction.id)).reminders.occurrences).toEqual(unknownHealth.reminders.occurrences)
    expect((await env.DB.prepare("SELECT id FROM invitation_participants WHERE workspace_id=? AND delivery_status='bounced'").bind(f.workspaceId).all()).results).toEqual([])
  } finally { send.mockRestore() }
})
