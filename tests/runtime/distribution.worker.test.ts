
import { contract } from '../../src/test/contract'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, test } from 'vitest'
import { foundationFixture } from './foundation-fixture'
import { MailDeliveries } from '../../src/core/features/distribution/deliveries'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
async function launched(slug: string, prefill?: {locked:boolean}, questionType:'short_text'|'nps'='short_text') {
  const f = await foundationFixture(slug)
  await f.add({ kind: 'question', questionType, prompt: 'Feedback', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Thank you' })
  if(prefill) { const draft=await f.draft(); await f.services.flows.updateFormSettings({...f.flow,expectedVersion:draft.flow.draftVersion,settings:{...draft.formSettings!,prefill:[{stepId:draft.steps[0].id,field:'company',locked:prefill.locked}]}}) }
  await f.publish()
  const contact = await f.services.distribution.contacts.save(f.scope.workspaceId, { name: 'Synthetic recipient', email: `${slug}@example.test`, fields: {company: 'Synthetic company'} }) as { id: string }
  const input = { ...f.flow, operatorId: f.operatorId, contactIds: [contact.id], commandKey: `command-${slug}` }
  const launch = await f.services.distribution.launches.launch(input)
  const p = (await env.DB.prepare('SELECT * FROM invitation_participants WHERE launch_id = ?').bind(launch.id).first())! as { id: string; token: string; opt_out_token: string; revision_id: string }
  const delivery = (await f.services.distribution.launches.list(f.scope.workspaceId, f.flow.flowId))[0] as { deliveryId: string }
  return { ...f, contact, input, launch, p, delivery }
}
contract(["AUD-003","AUD-006","DIST-003","DIST-005","FLOW-008","DIST-014","DIST-024"], 'invitation score buttons preserve the recipient snapshot, consent blocks sending and renewal records actor and source', async () => {
  const f = await launched('distribution-consent',undefined,'nps')
  expect(await f.services.distribution.launches.launch(f.input)).toEqual(f.launch)
  expect((await f.services.distribution.launches.list(f.scope.workspaceId, f.flow.flowId))).toHaveLength(1)
  await f.services.distribution.contacts.edit(f.scope.workspaceId, f.contact.id, { name: 'Changed name', email: 'changed-email@example.test' })
  const prepared = await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  expect(prepared).toMatchObject({ ordinal: 1, to: 'distribution-consent@example.test', idempotencyKey: `invitation:${f.p.id}`, headers: { 'Auto-Submitted': 'auto-generated' } })
  expect(prepared!.text).toContain(`/i/${f.p.token}`)
  expect(prepared!.text).toContain(`/optout/${f.p.opt_out_token}`)
  const buttons=[...prepared!.text.matchAll(/https?:\/\/[^\s]+\?__pencil_first=(\d+)/g)]
  expect(buttons.map(button=>Number(button[1]))).toEqual(Array.from({length:11},(_,index)=>index))
  expect(prepared!.html).toContain('aria-label="Feedback: 9"')
  expect((await env.DB.prepare('SELECT event FROM mail_delivery_attempts WHERE delivery_id = ?').bind(f.delivery.deliveryId).all()).results).toEqual([{ event: 'started' }])
  await f.services.distribution.deliveries.record(f.delivery.deliveryId, 1, { kind: 'transient', reason: 'Synthetic transport unavailable' })
  await f.services.distribution.contacts.optOut(f.p.opt_out_token)
  expect(await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test', new Date(Date.now() + 120000).toISOString())).toBeNull()
  await f.services.distribution.contacts.consent({ ...f.scope, contactId: f.contact.id, actor: f.operatorId, source: 'Explicit synthetic consent', renewed: true })
  expect((await env.DB.prepare('SELECT consent, actor, source FROM contact_consent_events WHERE contact_id = ? ORDER BY created_at').bind(f.contact.id).all()).results).toEqual([{ consent: 'opted-out', actor: 'recipient', source: 'invitation-opt-out' }, { consent: 'renewed', actor: f.operatorId, source: 'Explicit synthetic consent' }])
}, 60_000)
contract(["FLOW-008","FLOW-009","FLOW-017","RESP-008","DIST-004","RESP-007","LOGIC-002","LOGIC-007"], 'invitation prefill stays pinned, is editable and marked in the ledger, locks are enforced and one completion cancels reminders', async () => {
  const f = await launched('distribution-admission', {locked:false})
  await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  await f.services.distribution.deliveries.record(f.delivery.deliveryId, 1, { kind: 'sent', providerId: 'synthetic-provider-id' })
  const before = await f.services.responses.invitationFlow(f.p.token)
  const firstQuestion=before.publicFlow.steps.find(s=>s.kind==='question')!
  expect(before.publicFlow.prefilledAnswers).toEqual({[firstQuestion.id]:{value:'Synthetic company',locked:false}})
  expect(await f.services.flows.getPublicFlow(f.slug)).not.toHaveProperty('prefilledAnswers')
  await f.publish()
  const start = () => f.services.responses.startPublicSession({ slug: f.slug, deviceClass: 'desktop', source: 'direct', invitationToken: f.p.token })
  const [a, b] = await Promise.all([start(), start()])
  expect(a.revisionId).toBe(f.p.revision_id)
  expect(a.flow.steps).toEqual(before.publicFlow.steps)
  await f.services.distribution.contacts.edit(f.scope.workspaceId,f.contact.id,{name:'Synthetic recipient',email:'distribution-admission@example.test',fields:{company:'Synthetic response'}})
  await f.mature(a.sessionId); await f.mature(b.sessionId)
  const answers = [{ stepId: a.flow.steps.find(s => s.kind === 'question')!.id, value: 'Synthetic response' }]
  const outcomes = await Promise.allSettled([f.final(a, answers, '', f.p.token), f.final(b, answers, '', f.p.token)])
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1)
  expect((await env.DB.prepare('SELECT source, participant_id FROM responses WHERE participant_id = ?').bind(f.p.id).all()).results).toEqual([{ source: 'invitation', participant_id: f.p.id }])
  expect(await env.DB.prepare('SELECT device_class FROM responses WHERE participant_id=?').bind(f.p.id).first()).toEqual({device_class:'desktop'})
  const ledger=await f.services.reporting.ledger(f.scope.workspaceId,f.flow.flowId,{search:'Synthetic response'})
  expect(ledger.responses[0].answers[0]).toMatchObject({value:'Synthetic response',prefill:'edited'})
  expect(JSON.parse((await env.DB.prepare('SELECT response_context_json AS context FROM responses WHERE participant_id=?').bind(f.p.id).first<{context:string}>())!.context).prefill).toEqual({[firstQuestion.id]:'edited'})
  expect(JSON.stringify(ledger.responses)).not.toContain('Synthetic company')
  const locked=await launched('distribution-locked',{locked:true})
  const lockedStart=await locked.services.responses.startPublicSession({slug:locked.slug,deviceClass:'desktop',source:'direct',invitationToken:locked.p.token})
  await locked.mature(lockedStart.sessionId)
  await expect(locked.services.responses.submitPublicResponse({slug:locked.slug,sessionId:lockedStart.sessionId,sessionToken:lockedStart.sessionToken,loadTime:await locked.loadTime(lockedStart),idempotencyKey:'synthetic-pencil-proof',invitationToken:locked.p.token,answers:[{stepId:lockedStart.flow.steps[0].id,value:'Synthetic company'}]})).rejects.toThrow('verified')
  const lockedQuestion=lockedStart.flow.steps.find(s=>s.kind==='question')!
  await expect(locked.final(lockedStart,[{stepId:lockedQuestion.id,value:'Changed'}],'',locked.p.token)).rejects.toThrow('locked')
  await locked.final(lockedStart,[{stepId:lockedQuestion.id,value:'Synthetic company'}],'',locked.p.token)
  const lockedResponse=(await env.DB.prepare('SELECT id,device_class FROM responses WHERE participant_id=?').bind(locked.p.id).first<{id:string;device_class:string}>())!
  expect(lockedResponse.device_class).toBe('desktop')
  expect(await env.DB.prepare('SELECT id FROM respondent_sessions WHERE id=?').bind(lockedStart.sessionId).first()).toBeNull()
  expect((await locked.services.reporting.ledger(locked.scope.workspaceId,locked.flow.flowId,{})).responses[0].answers[0].prefill).toBe('locked')
  await locked.services.distribution.contacts.erase(locked.scope.workspaceId,locked.contact.id,locked.operatorId)
  expect(await env.DB.prepare('SELECT device_class FROM responses WHERE id=?').bind(lockedResponse.id).first()).toBeNull()
  expect((await locked.services.reporting.ledger(locked.scope.workspaceId,locked.flow.flowId,{})).total).toBe(0)
  expect((await env.DB.prepare("SELECT status FROM mail_deliveries WHERE participant_id = ? AND kind = 'reminder'").bind(f.p.id).first())).toEqual({ status: 'cancelled' })
  expect((await f.services.responses.invitationFlow(f.p.token)).publicFlow.completedStepId).toBe(a.flow.steps.find(s => s.kind === 'completion')!.id)
  await expect(start()).rejects.toThrow('already completed')
  const invalid=await foundationFixture('distribution-prefill-publication')
  await invalid.add({kind:'question',questionType:'number',prompt:'Team size',required:true})
  await invalid.add({kind:'completion',questionType:null,prompt:'Recorded'})
  for(const stepId of [(await invalid.draft()).steps[0].id,'deleted-question']) {
    const draft=await invalid.draft()
    await invalid.services.flows.updateFormSettings({...invalid.flow,expectedVersion:draft.flow.draftVersion,settings:{...draft.formSettings!,prefill:[{stepId,field:'company',locked:false}]}})
    await expect(invalid.publish()).rejects.toMatchObject({details:expect.arrayContaining([expect.objectContaining({stepId})])})
  }
  const malformed=await foundationFixture('distribution-prefill-invalid-value')
  await malformed.add({kind:'question',questionType:'email',prompt:'Email address',required:true})
  await malformed.add({kind:'completion',questionType:null,prompt:'Recorded'})
  const malformedDraft=await malformed.draft()
  await malformed.services.flows.updateFormSettings({...malformed.flow,expectedVersion:malformedDraft.flow.draftVersion,settings:{...malformedDraft.formSettings!,prefill:[{stepId:malformedDraft.steps[0].id,field:'company',locked:true}]}})
  await malformed.publish()
  const badContact=await malformed.services.distribution.contacts.save(malformed.scope.workspaceId,{name:'Synthetic invalid contact value',email:'synthetic-pencil-invalid@example.test',fields:{company:'Not an email'}}) as {id:string}
  await malformed.services.distribution.launches.launch({...malformed.flow,operatorId:malformed.operatorId,contactIds:[badContact.id],commandKey:'synthetic-pencil-invalid-prefill'})
  const badInvitation=(await env.DB.prepare('SELECT token FROM invitation_participants WHERE contact_id=?').bind(badContact.id).first<{token:string}>())!
  expect((await malformed.services.responses.invitationFlow(badInvitation.token)).publicFlow.prefilledAnswers).toEqual({})
  await f.services.flows.closeFlow(f.scope.workspaceId, f.flow.flowId)
  await expect(f.services.responses.invitationFlow(f.p.token)).rejects.toThrow('no longer accepting')
}, 60_000)
contract(['DIST-006', 'DIST-008', 'DIST-010', 'BASE-OPS-004'], 'ambiguous delivery never automatically retries and permanent failure requires an operator retry', async () => {
  const f = await launched('distribution-unknown')
  const d = new MailDeliveries(env.DB)
  const first = await d.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  await d.record(f.delivery.deliveryId, 1, { kind: 'unknown', reason: 'Synthetic timeout without provider lookup' })
  expect(await d.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')).toBeNull()
  await expect(d.retry(f.scope.workspaceId, f.delivery.deliveryId, f.operatorId, false)).rejects.toThrow('duplicate')
  await d.retry(f.scope.workspaceId, f.delivery.deliveryId, f.operatorId, true)
  const second = await d.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  expect(second!.idempotencyKey).toBe(first!.idempotencyKey)
  expect(second!.ordinal).toBe(2)
  await d.record(f.delivery.deliveryId, 2, { kind: 'permanent', reason: 'Synthetic invalid recipient' })
  expect((await f.services.distribution.launches.list(f.scope.workspaceId, f.flow.flowId))[0]).toMatchObject({ status: 'failed', reason: 'Synthetic invalid recipient', attempts: 2 })
  await expect(d.record(f.delivery.deliveryId, 2, { kind: 'sent', providerId: 'incorrect-late-receipt' })).rejects.toThrow('already has an outcome')
}, 60_000)
contract(['WS-002', 'DIST-004', 'DIST-006', 'DIST-008'], 'transient attempts keep one key, stop after five retries, and reminders wait for workspace hours', async () => {
  const f = await launched('distribution-retries')
  const firstAt = '2026-10-06T00:00:00.000Z'
  await env.DB.prepare('UPDATE mail_deliveries SET available_at = ? WHERE id = ?').bind(firstAt, f.delivery.deliveryId).run()
  let time = firstAt
  for (let ordinal = 1; ordinal <= 6; ordinal++) {
    const call = await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test', time)
    expect(call).toMatchObject({ ordinal, idempotencyKey: `invitation:${f.p.id}` })
    await f.services.distribution.deliveries.record(f.delivery.deliveryId, ordinal, { kind: 'transient', reason: 'Synthetic transient' }, time)
    const row = await env.DB.prepare('SELECT available_at, status FROM mail_deliveries WHERE id = ?').bind(f.delivery.deliveryId).first<{ available_at: string; status: string }>()
    if (ordinal === 6) expect(row!.status).toBe('failed')
    else { expect(row!.status).toBe('pending'); time = row!.available_at }
  }
  expect(await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test', '2026-10-06T02:00:00.000Z')).toBeNull()
  const g = await launched('distribution-window')
  await g.services.distribution.deliveries.prepare(g.delivery.deliveryId, 'https://synthetic.example.test')
  const sent = '2026-10-06T18:00:00.000Z'
  await g.services.distribution.deliveries.record(g.delivery.deliveryId, 1, { kind: 'sent', providerId: 'synthetic' }, sent)
  const reminder = await env.DB.prepare("SELECT id, available_at FROM mail_deliveries WHERE participant_id = ? AND kind = 'reminder'").bind(g.p.id).first<{ id: string; available_at: string }>()
  expect(reminder!.available_at).toBe('2026-10-08T18:00:00.000Z')
  await g.services.workspace.updateSettings({ ...g.scope, timeZone: 'UTC', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' })
  expect(await g.services.distribution.deliveries.prepare(reminder!.id, 'https://synthetic.example.test', reminder!.available_at)).toBeNull()
  expect((await env.DB.prepare('SELECT available_at FROM mail_deliveries WHERE id = ?').bind(reminder!.id).first())).toEqual({ available_at: '2026-10-09T09:00:00.000Z' })
  expect(await g.services.distribution.deliveries.prepare(reminder!.id, 'https://synthetic.example.test', '2026-10-09T09:00:00.000Z')).toMatchObject({ ordinal: 1, idempotencyKey: `reminder:${g.p.id}` })
}, 60_000)

contract(['RESP-013', 'RESP-006', 'DIST-004'], 'invited sessions retain no participant identity and erased bearer links cannot finalize or send after target closure', async () => {
  const f = await launched('distribution-session-privacy')
  const session = await f.services.responses.startPublicSession({ slug: f.slug, deviceClass: 'tablet', source: 'direct', invitationToken: f.p.token })
  const row = await env.DB.prepare('SELECT * FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first()
  expect(row).toMatchObject({ source: 'invitation', revision_id: f.p.revision_id, device_class: 'tablet' })
  for (const key of Object.keys(row!)) expect(key).not.toMatch(/participant|contact|email|name|answer|address|user_agent|host/)
  expect(JSON.stringify(row)).not.toContain(f.p.id)
  expect(JSON.stringify(row)).not.toContain(f.p.token)
  await f.mature(session.sessionId)
  const answers = [{ stepId: session.flow.steps[0].id, value: 'No identity in session state' }]
  await expect(f.final(session, answers)).rejects.toThrow('session')
  await f.services.distribution.contacts.erase(f.scope.workspaceId, f.contact.id, f.operatorId)
  await expect(f.final(session, answers, '', f.p.token)).rejects.toThrow('session')
  expect(await env.DB.prepare('SELECT count(*) AS n FROM responses WHERE revision_id = ?').bind(f.p.revision_id).first()).toEqual({ n: 0 })
  expect(await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')).toBeNull()

  const g = await launched('distribution-target-send')
  const s = await g.start(); await g.mature(s.sessionId)
  await g.final(s, [{ stepId: s.flow.steps[0].id, value: 'Reached target' }])
  // Quarantine release may meet a target without retriggering its admission flag.
  await env.DB.prepare('UPDATE flow_revisions SET target_completed_responses = 1, admission_closed_at = NULL WHERE id = ?').bind(g.p.revision_id).run()
  expect(await g.services.distribution.deliveries.prepare(g.delivery.deliveryId, 'https://synthetic.example.test')).toBeNull()
  expect(await env.DB.prepare('SELECT count(*) AS n FROM mail_delivery_attempts WHERE delivery_id = ?').bind(g.delivery.deliveryId).first()).toEqual({ n: 0 })
}, 60_000)
