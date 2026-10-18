import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { countryChoices } from '../../src/core/shared/choiceLists'
import manifest from '../../seed.json'
import { fixtureExport } from '../helpers/report-download'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract('FIELD-014', 'publishes and collects a 250-question form with a thousand-option dropdown mixing pages, groups and standalone questions, and preserves IDs through edit and export', async () => {
  const f = await foundationFixture('long-business-intake')
  const options = Array.from({ length: 1000 }, (_, index) => ({ label: `Office ${index + 1}`, value: `office-${index + 1}` }))
  await f.add({ kind: 'question', questionType: 'dropdown', prompt: 'Choose your office', required: true, choices: options })
  await f.add({kind:'question',questionType:'dropdown',prompt:'Country',required:true,choices:countryChoices})
  for (let index = 2; index < 250; index++) await f.add({ kind: 'question', questionType: 'short_text', prompt: `Intake item ${index + 1}`, required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Intake received' })
  let draft = await f.draft()
  await expect(f.add({ kind: 'question', questionType: 'short_text', prompt: 'Over capacity' })).rejects.toThrow('question limit')
  const q = draft.steps[0]
  const allChoiceIds=draft.choices.map(choice=>choice.id)
  const us=draft.choices.find(choice=>choice.stepId===draft.steps[1].id&&choice.value==='US')!
  const choices = draft.choices.filter(choice => choice.stepId === q.id)
  await expect(f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: q.id, prompt: q.prompt, required: true, choices: [...choices, { label: 'One too many', value: 'overflow' }] })).rejects.toThrow('choice limit')
  const overflow=crypto.randomUUID(), now=new Date().toISOString()
  const row=await env.DB.prepare('SELECT id FROM flow_steps WHERE revision_id=? AND stable_id=?').bind(draft.revision.id,q.id).first<{id:string}>()
  await env.DB.prepare('INSERT INTO choice_options(id,step_id,stable_id,value,label,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(overflow,row!.id,overflow,'overflow','One too many',1000,now,now).run()
  await expect(f.publish()).rejects.toMatchObject({details:expect.arrayContaining([expect.objectContaining({stepId:q.id,reason:expect.stringContaining('choice limit')})])})
  await env.DB.prepare('DELETE FROM choice_options WHERE id=?').bind(overflow).run()
  const edited = await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: q.id, prompt: q.prompt, required: true, choices: choices.map((choice, i) => ({ ...choice, label: i === 999 ? 'Head office' : choice.label })) })
  expect(edited.kind).toBe('updated')
  draft = await f.draft()
  expect(draft.choices.map(choice => choice.id)).toEqual(allChoiceIds)
  for(const [start,end,kind,title] of [[0,80,'group','Office details'],[80,160,'page','Operations']] as const) {
    const current=await f.draft()
    await f.services.flows.updateScreen({...f.flow,expectedVersion:current.flow.draftVersion,stepId:current.steps[start].id,layout:{kind,title,questionIds:current.steps.slice(start,end).map(step=>step.id)}})
  }
  draft=await f.draft()
  await f.publish()
  const publicPage = await f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}`)
  expect(publicPage.status).toBe(200)
  const publicFlow = await publicPage.json() as { choices: Array<{ id: string;stepId:string }>;steps:Array<{kind:string;questionSettings?:Record<string,unknown>}> }
  expect(publicFlow.steps.filter(step=>step.kind==='question')).toHaveLength(250)
  expect(publicFlow.steps[0].questionSettings?.screen).toMatchObject({kind:'group',questionIds:draft.steps.slice(0,80).map(step=>step.id)})
  expect(publicFlow.steps[80].questionSettings?.screen).toMatchObject({kind:'page',questionIds:draft.steps.slice(80,160).map(step=>step.id)})
  expect(publicFlow.choices.filter(choice=>choice.stepId===q.id)).toHaveLength(1000)
  expect(publicFlow.choices.filter(choice=>choice.stepId===draft.steps[1].id)).toHaveLength(countryChoices.length)
  const session = await f.start(); await f.mature(session.sessionId)
  const screenTimes: number[] = [], transitionTimes: number[] = []
  for (let index = 0; index < 20; index++) {
    let at = performance.now()
    const screen = await f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}`, { headers: { 'CF-Connecting-IP': '198.18.219.11' } })
    expect(screen.status).toBe(200); await screen.text(); screenTimes.push(performance.now() - at)
    at = performance.now()
    const moved = await f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}/sessions/advance`, { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.219.12' }, body: JSON.stringify({ sessionId: session.sessionId, sessionToken: session.sessionToken, stepId: draft.steps[index].id }) })
    expect(moved.status).toBe(204); transitionTimes.push(performance.now() - at)
  }
  const p95 = (values: number[]) => values.sort((a,b) => a-b)[Math.ceil(values.length * .95)-1]
  expect(p95(screenTimes)).toBeLessThanOrEqual(manifest.limits.p95Milliseconds.publicScreen)
  expect(p95(transitionTimes)).toBeLessThanOrEqual(manifest.limits.p95Milliseconds.answerTransition)
  console.log('Longest-form native route p95 milliseconds', { publicScreen: p95(screenTimes), answerTransition: p95(transitionTimes), samples: 20 })
  const answers = draft.steps.filter(step => step.kind === 'question').map((step, i) => ({ stepId: step.id, value: i === 0 ? choices[999].id : i===1?us.id:`Our answer ${i + 1}` }))
  const response = await f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}/responses`, { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.219.10' }, body: JSON.stringify({ sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: await f.loadTime(session), idempotencyKey: `long-${session.sessionId}`, answers }) })
  expect(response.status, await response.clone().text()).toBe(201)
  const exported = await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, {})
  expect(exported.responses).toHaveLength(1)
  expect(exported.responses[0].answers).toHaveLength(250)
  expect(exported.responses[0].answers[0].value).toBe('office-1000')
  expect(exported.responses[0].answers[1].value).toBe('US')
}, 120_000)
