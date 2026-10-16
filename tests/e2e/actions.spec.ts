import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { operatorEmail } from './auth-identity'
import { contract } from './contract'
import { expect, openMailLink, test } from './fixtures'
import { startTaskReceiver } from './task-receiver'
import type { BuilderDraft } from '../../src/core/app/api'

async function axe(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations.map(violation => violation.id)).toEqual([])
}

contract(['ACT-001', 'ACT-002', 'ACT-003', 'ACT-005', 'ACT-006', 'ACT-007', 'ACT-008'], 'an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due', async ({ page }, info) => {
  test.setTimeout(180_000)
  const viewport = info.project.name === 'mobile' ? 'mobile' : 'desktop'
  const capture = async (step: string) => {
    if (!process.env.PENCIL_CAPTURE_DIR) return
    await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${viewport}-${step}.png`), fullPage: true })
  }
  const receiver = await startTaskReceiver()
  try {
    const email = operatorEmail()
    await page.goto('/signin'); await page.getByLabel('Operator email').fill(email)
    await page.getByRole('button', { name: /Send.*link/i }).click()
    await openMailLink(page, email)
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()

    // Native responses collected through the public endpoints.
    const call = async <T,>(path: string, data?: unknown): Promise<T> => {
      const response = await page.request.fetch(path, { method: data === undefined ? 'GET' : 'POST', ...(data === undefined ? {} : { data }) })
      expect(response.status(), path).toBeLessThan(300)
      return response.status() === 204 ? undefined as T : await response.json() as T
    }
    const slug = `actions-${viewport}-${Date.now()}`, suffix = viewport
    const flow = await call<{ id: string }>('/api/app/flows', { title: `Counter visit ${suffix}`, slug })
    const draft = () => call<BuilderDraft>(`/api/app/flows/${flow.id}/draft`)
    await call(`/api/app/flows/${flow.id}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step: { kind: 'question', questionType: 'single_choice', prompt: 'How was the wait?', required: true, choices: [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Too long' }] } })
    await call(`/api/app/flows/${flow.id}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Thanks' } })
    await call(`/api/app/flows/${flow.id}/publish`, { expectedVersion: (await draft()).flow.draftVersion })
    const published = await draft(), question = published.steps.find(step => step.prompt === 'How was the wait?')!
    for (const [index, label] of ['Short', 'Too long', 'Too long'].entries()) {
      const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
      const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: `${slug}-${index}`, answers: [{ stepId: question.id, value: published.choices.find(choice => choice.stepId === question.id && choice.label === label)!.id }] })
      if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    }

    // Results: turn the question's numbers into an action.
    await page.goto(`/app/flows/${flow.id}/results`)
    const answers = page.getByRole('region', { name: 'Answers', exact: true })
    await expect(answers.getByText('2 of 3 answers · 67%')).toBeVisible()
    await capture('results')
    await answers.getByRole('link', { name: 'Turn this into an action: How was the wait?' }).click()
    await expect(page.getByRole('heading', { name: 'New action' })).toBeVisible()
    await expect(page.getByText('Too long: 2 of 3 answers · 67%')).toBeVisible()
    await page.getByLabel('Title').fill(`Open a second till ${suffix}`)
    await page.getByLabel('Rationale').fill('Two of three visitors said the wait was too long.')
    await page.getByLabel('Metric', { exact: true }).fill('Visitors saying the wait was short')
    await page.getByLabel('Baseline value').fill('33')
    await page.getByLabel('Review date').fill('2027-01-15')
    await axe(page)
    await capture('new-action')
    await page.getByRole('button', { name: 'Save action' }).click()
    await expect(page.getByRole('heading', { name: `Open a second till ${suffix}` })).toBeVisible()
    await expect(page.getByText('Planned · recommendation written by an operator')).toBeVisible()
    await axe(page)
    await capture('action-planned')
    expect(receiver.requests).toEqual([])

    // Configure the receiver from the offered page, then prove its test uses
    // create-or-get before sending this real action through the normal preview.
    await page.getByLabel('Endpoint URL').fill(`http://127.0.0.1:${process.env.PENCIL_E2E_TASK_PORT ?? Number(process.env.PENCIL_E2E_PORT ?? '4173') + 2}/tasks`)
    await page.getByLabel('Bearer key').fill('synthetic-page-task-key')
    await page.getByRole('button', { name: 'Save connection', exact: true }).click()
    await expect(page.getByText('Connection saved. You can send a test task now.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Bearer key')).toHaveValue('')
    expect(await (await page.request.get('/api/app/connections/task')).text()).not.toContain('synthetic-page-task-key')
    await page.getByRole('button', { name: 'Send test task', exact: true }).click()
    await expect(page.getByText(/Returned task ID: browser-task-1/)).toBeVisible()
    await page.getByRole('button', { name: 'Send test task', exact: true }).click()
    await expect(page.getByText(/Returned task ID: browser-task-1/)).toBeVisible()
    expect(receiver.requests).toHaveLength(2)
    expect(receiver.requests[0].idempotencyKey).toBe(receiver.requests[1].idempotencyKey)
    expect(receiver.tasks.size).toBe(1)
    expect(JSON.parse(receiver.requests[0].body).action.title).toBe('Pencil connection test')
    await capture('connection-tested')

    await page.getByRole('button', { name: 'Start work' }).click()
    await expect(page.getByText('In progress · recommendation written by an operator')).toBeVisible()

    // The confirmation screen shows exactly the JSON that leaves.
    await page.getByRole('button', { name: 'Create external task' }).click()
    const shown = page.getByLabel('Task JSON')
    await expect(shown).toBeVisible()
    const payload = JSON.parse(await shown.innerText())
    expect(Object.keys(payload.action).sort()).toEqual(['metric', 'owner', 'rationale', 'reportLink', 'reviewDate', 'title'])
    await axe(page)
    await capture('confirm-task')
    expect(receiver.requests).toHaveLength(2)
    await page.getByRole('button', { name: 'Confirm and send' }).click()
    await expect(page.getByText('Remote task ID')).toBeVisible()
    await expect(page.getByText('browser-task-2', { exact: true })).toBeVisible()
    await expect(page.getByText(/Delivery: Confirmed/)).toBeVisible()
    expect(receiver.requests).toHaveLength(3)
    expect(JSON.parse(receiver.requests[2].body)).toEqual(payload)
    expect(receiver.requests[2].authorization).toBe('Bearer synthetic-page-task-key')
    await capture('task-confirmed')

    // Measure, see the difference, decide.
    await page.getByRole('button', { name: 'Ready for review' }).click()
    await expect(page.getByText('Ready for review · recommendation written by an operator')).toBeVisible()
    await page.getByLabel('Observed value').fill('52')
    await page.getByRole('button', { name: 'Record observed value' }).click()
    await expect(page.getByText('+19 percent')).toBeVisible()
    await expect(page.getByText(/in the desired direction/)).toBeVisible()
    await expect(page.getByText('Ready for review · recommendation written by an operator')).toBeVisible()
    await capture('measured')
    await page.getByLabel('Note for the next step (optional)').fill('Lunch queues halved after the second till opened.')
    await page.getByRole('button', { name: 'Mark effective' }).click()
    await expect(page.getByText('Effective · recommendation written by an operator')).toBeVisible()
    await page.getByRole('button', { name: 'Close action' }).click()
    await expect(page.getByText('Closed · verdict effective · recommendation written by an operator')).toBeVisible()
    await expect(page.getByText('A closed action stays closed.')).toBeVisible()
    await capture('closed')

    // A second action whose review date has passed: shown as review due, untouched.
    const self = (await call<Array<{ id: string; email: string }>>('/api/app/operators')).find(operator => operator.email === email)!
    const overdue = await call<{ id: string; state: string }>('/api/app/actions', {
      title: `Reprint the menu board ${suffix}`, rationale: 'Visitors asked for larger prices.', ownerOperatorId: self.id,
      reviewDate: '2026-01-15', metric: { name: 'Visitors finding prices easily', unit: 'percent', direction: 'increase', baselineValue: 40, baselineSource: 'Revision 1 results', baselineObservedAt: '2026-01-01T09:00:00.000Z' },
      evidence: { flowId: flow.id, revisionId: (await call<{ revision: { id: string } }>(`/api/app/flows/${flow.id}/results`)).revision.id },
    })
    await page.goto('/app/actions')
    const item = page.getByRole('listitem').filter({ hasText: `Reprint the menu board ${suffix}` })
    await expect(item.getByText('Review due')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: `Open a second till ${suffix}` }).getByText('Review due')).toHaveCount(0)
    await axe(page)
    await capture('actions-list')
    await page.goto('/app')
    await expect(page.getByText(/reached the review date/)).toBeVisible()
    await capture('dashboard')
    const after = await call<{ state: string; verdict: string | null; history: unknown[] }>(`/api/app/actions/${overdue.id}`)
    expect([after.state, after.verdict, after.history.length]).toEqual(['planned', null, 1])
    expect(receiver.tasks.size).toBe(2)
    await page.request.delete('/api/app/connections/task', { data: {} })
  } finally { await receiver.close() }
})
