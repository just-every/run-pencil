import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export async function proveResourceWriteReadback({ mcp, hosted, cookie, draft, uri }) {
  const question = draft.steps.find(step => step.kind === 'question')
  assert.ok(question?.prompt, 'The created native draft must contain a populated question')
  const prompt = 'Synthetic Pencil resource question changed after creation.'
  assert.ok(!prompt.includes(question.prompt), 'The changed prompt must exclude the original question prompt')
  const updated = await mcp('tools/call', { name: 'pencil.flows.update_step', arguments: {
    flowId: draft.flow.id, stepId: question.id, prompt, required: question.required,
    expectedVersion: draft.flow.draftVersion, expected_revision: draft.flow.draftVersion,
    idempotency_key: randomUUID(),
  } })
  assert.equal(updated.response.status, 200)
  assert.equal(updated.body.error, undefined)
  assert.ok(updated.body.result && !updated.body.result.isError, 'The declared update tool must complete')
  const links = updated.body.result.content.filter(item => item.type === 'resource_link')
  assert.equal(links.length, 1, 'Updating a question must return its form resource link')
  assert.equal(links[0].uri, uri, 'The update must link to the same form resource as creation')
  assert.ok(links[0].name)

  const read = await mcp('resources/read', { uri })
  assert.equal(read.response.status, 200)
  assert.equal(read.body.error, undefined)
  const contents = read.body.result?.contents
  assert.equal(contents?.length, 1)
  assert.equal(contents[0].uri, uri)
  assert.equal(contents[0]._meta?.['com.runeditrun/untrusted'], true)
  const resource = JSON.parse(contents[0].text)
  const native = await hosted.fetch(`api/app/flows/${draft.flow.id}/draft`, { headers: { Cookie: cookie } })
  assert.equal(native.status, 200)
  const current = await native.json()
  assert.equal(current.flow.draftVersion, draft.flow.draftVersion + 1, 'The native write must advance the draft exactly once')
  assert.equal(current.steps.find(step => step.id === question.id)?.prompt, prompt)
  assert.deepEqual(resource, { ...current, stepIds: current.steps.map(step => step.id) }, 'Updated resource fields must equal a fresh native authorized builder read')
  assert.equal(resource.flow.draftVersion, draft.flow.draftVersion + 1)
  const readQuestion = resource.steps.find(step => step.id === question.id)
  assert.equal(readQuestion?.prompt, prompt, 'The same resource URI must expose the saved question')
  assert.ok(!readQuestion.prompt.includes(question.prompt), 'The updated question must not retain its prior prompt')
}
