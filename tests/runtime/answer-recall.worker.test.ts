import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { ulid } from 'ulid'
import { contract } from '../../src/test/contract'
import type { BuilderDraft, PublicFlow } from '../../src/core/app/api'
import { renderRecallScreen } from '../../src/core/shared/recall'
import { authoringClient } from './choice-recall-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['LOGIC-001'], 'published recall follows earlier valid answers on the active path, updates back edits, keeps inserted templates inert and rejects ambiguous references', async () => {
  const f = await authoringClient(), form = await f.create('Northstar personalized intake')
  const workshop = ulid(), finish = ulid(), other = ulid()
  await form.add({ kind: 'question', questionType: 'short_text', prompt: 'What is your name?', required: true, questionSettings: { recallKey: 'name' } })
  await form.add({ kind: 'question', questionType: 'single_choice', prompt: '{{name}}, what would you like?', helperText: 'Choose an option, {{ name }}.', required: true, questionSettings: { recallKey: 'service', otherChoiceId: other }, choices: [{ newId: workshop, value: 'workshop', label: 'Workshop for {{name}}' }, { newId: finish, value: 'finish', label: 'Finish now' }, { newId: other, value: 'other', label: 'Other' }] })
  await form.add({ kind: 'question', questionType: 'long_text', prompt: 'More about {{service}}', required: false, questionSettings: { recallKey: 'detail' } })
  await form.add({ kind: 'question', questionType: 'thumbs_rating', prompt: 'Was this easy?', required: true, questionSettings: { recallKey: 'easy' } })
  await form.add({ kind: 'completion', questionType: null, prompt: 'Thank you {{name}}: {{service}}. {{detail}}', helperText: 'Your rating: {{easy}}. Literal {{{name}}}.' })
  let draft = await form.draft()
  const [name, service, detail, easy, completion] = draft.steps
  await f.call(form.root + '/draft/branches', { expectedVersion: draft.flow.draftVersion, rules: [{ sourceStepId: service.id, predicateKind: 'equals', expectedValue: finish, destinationStepId: easy.id, position: 0 }] }, 'PUT')
  for (const prompt of ['{{unknown}}', '{{service}}', '{{detail}}']) {
    await form.update(service.id, { prompt })
    const refused = await f.request(form.root + '/publish', { expectedVersion: (await form.draft()).flow.draftVersion })
    expect(refused.status).toBe(400); expect(await refused.text()).toContain('Recall')
  }
  await form.update(service.id, { prompt: service.prompt })
  await form.update(detail.id, { questionSettings: { recallKey: 'name' } })
  expect((await f.request(form.root + '/publish', { expectedVersion: (await form.draft()).flow.draftVersion })).status).toBe(400)
  await form.update(detail.id, { questionSettings: { recallKey: 'detail' } }); await form.publish()
  const publicFlow = await f.call<PublicFlow>(`/api/public/flows/${form.slug}`)
  const answers = { [name.id]: 'Taylor', [service.id]: workshop, [detail.id]: 'Accessible venue', [easy.id]: false }
  const screen = renderRecallScreen(publicFlow, answers, publicFlow.steps.find(step => step.id === service.id)!)
  expect(screen.step).toMatchObject({ prompt: 'Taylor, what would you like?', helperText: 'Choose an option, Taylor.' })
  expect(screen.choices.find(choice => choice.id === workshop)?.label).toBe('Workshop for Taylor')
  const done = publicFlow.steps.find(step => step.id === completion.id)!
  expect(renderRecallScreen(publicFlow, answers, done).step).toMatchObject({ prompt: 'Thank you Taylor: Workshop for Taylor. Accessible venue', helperText: 'Your rating: Thumbs down. Literal {{{name}}}.' })
  const backEdit = { ...answers, [name.id]: 'Morgan' }
  expect(renderRecallScreen(publicFlow, backEdit, done).step.prompt).toBe('Thank you Morgan: Workshop for Morgan. Accessible venue')
  expect(renderRecallScreen(publicFlow, { ...backEdit, [service.id]: finish }, done).step.prompt).toBe('Thank you Morgan: Finish now. ')
  expect(renderRecallScreen(publicFlow, { ...answers, [service.id]: { choiceIds: [other], other: { choiceId: other, text: 'Accessibility workshops' } } }, done).step.prompt).toBe('Thank you Taylor: Accessibility workshops. Accessible venue')
  const inert = '<img src=x onerror=alert(1)> {{detail}}'
  expect(renderRecallScreen(publicFlow, { ...answers, [name.id]: inert }, done).step.prompt).toBe(`Thank you ${inert}: Workshop for ${inert}. Accessible venue`)
  expect(renderRecallScreen(publicFlow, { ...answers, [name.id]: '' }, service).step.prompt).toBe(', what would you like?')
  const session = await form.session()
  const response = await f.call<{ disposition: string }>(`/api/public/flows/${form.slug}/responses`, { ...session, idempotencyKey: session.sessionId, answers: Object.entries(answers).map(([stepId, value]) => ({ stepId, value })) })
  expect(response.disposition).toBe('released')
  draft = await form.draft()
  await f.call(`${form.root}/draft/steps/${name.id}/duplicate`, { expectedVersion: draft.flow.draftVersion })
  const afterCopy = await form.draft()
  expect(afterCopy.steps.filter(step => step.questionSettings?.recallKey === 'name')).toHaveLength(1)
  const copied = await f.call<{ id: string }>(form.root + '/duplicate', { title: 'Repeated personalized intake', slug: form.slug + '-copy' })
  const copy = await f.call<BuilderDraft>(`/api/app/flows/${copied.id}/draft`)
  expect(copy.steps.filter(step => step.kind === 'question').map(step => step.questionSettings?.recallKey).filter(Boolean)).toEqual(['name', 'service', 'detail', 'easy'])
}, 90000)
