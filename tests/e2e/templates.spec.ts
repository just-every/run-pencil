import { expect, test } from './fixtures'
import { startStripeReceiver, stripeFixture } from './stripe-receiver'
import type { Request } from '@playwright/test'
import { flowTemplates } from '../../src/core/features/flows/templates'
import { openStateDatabase, stateDatabaseFile } from './state-database'
import { checkAuthoringLayout, signInEmptyWorkspace } from './authoring-helpers'

test('built-in templates each progress from an empty dashboard to publication, response and counted result', async ({ page }, info) => {
  test.setTimeout(300_000)
  const stripe = await startStripeReceiver(new URL(process.env.PENCIL_E2E_BASE_URL!).origin)
  try {
  for (const template of ['Customer feedback', 'NPS', 'Contact/lead']) {
    await test.step(template, async () => {
      await page.context().clearCookies()
  test.setTimeout(300_000)
  await page.context().newCDPSession(page).then(session => session.send('Emulation.setCPUThrottlingRate', { rate: 4 }))
  await signInEmptyWorkspace(page)
  for (const name of ['Customer feedback', 'NPS', 'Contact/lead']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  const longestTitle = (await page.locator('.template-gallery button').allTextContents()).sort((a, b) => b.length - a.length)[0]
  await page.getByRole('button', { name: longestTitle, exact: true }).click()
  await checkAuthoringLayout(page)
  await page.screenshot({ path: info.outputPath(`${info.project.name}-gallery-longest.png`), fullPage: true })
  await page.getByLabel('Search templates', { exact: true }).fill('Delivery experience')
  await expect(page.getByRole('button', { name: 'Delivery experience', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'NPS', exact: true })).toHaveCount(0)
  await page.getByLabel('Template category', { exact: true }).selectOption('Customer feedback')
  await page.getByRole('button', { name: 'Delivery experience', exact: true }).click()
  await expect(page.getByText('Positive → What to keep · Needs attention → What to improve')).toBeVisible()
  await checkAuthoringLayout(page)
  if (template === 'Customer feedback') {
    const preview = page.getByRole('region', { name: 'Template preview', exact: true })
    const state = () => {
      const db = openStateDatabase(stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!))
      try {
        const tables = ['flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'respondent_sessions', 'respondent_session_step_events', 'responses', 'response_answers', 'revision_metric_counters', 'revision_step_metric_counters', 'response_outbox', 'audit_entries', 'rer_mail_development_outbox']
        return tables.map(table => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())
      } finally { db.close() }
    }
    const before = state()
    const owner = (await (await page.request.get('/auth/session')).json()).operator
    const effects: string[] = []
    const observe = (request: Request) => {
      const url = new URL(request.url())
      if (url.origin !== new URL(page.url()).origin || url.pathname.startsWith('/api/public/') || !['GET', 'HEAD'].includes(request.method())) effects.push(`${request.method()} ${url.pathname}`)
    }
    page.on('request', observe)
    try {
      await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
      await expect(preview.getByRole('alert')).toBeVisible()
      await expect(preview.getByRole('radio', { name: 'Positive', exact: true })).toBeVisible()
      await preview.getByRole('radio', { name: 'Positive', exact: true }).click()
      await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
      await expect(preview.getByRole('textbox', { name: 'What should we keep doing?', exact: true })).toBeVisible()
      await preview.getByRole('textbox').fill('synthetic-pencil-positive')
      await page.screenshot({ path: info.outputPath(`${info.project.name}-gallery-preview-positive.png`), fullPage: true })
      await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
      await expect(preview.getByRole('status')).toHaveText('Preview complete')
      await preview.getByRole('button', { name: 'Back in preview', exact: true }).click()
      await preview.getByRole('button', { name: 'Back in preview', exact: true }).click()
      await preview.getByRole('radio', { name: 'Needs attention', exact: true }).click()
      await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
      await expect(preview.getByRole('textbox', { name: 'What should we improve?', exact: true })).toHaveValue('')
      await preview.getByRole('textbox').fill('synthetic-pencil-improve')
      await page.screenshot({ path: info.outputPath(`${info.project.name}-gallery-preview-improve.png`), fullPage: true })
      await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
      await expect(preview.getByRole('status')).toHaveText('Preview complete')
      await preview.getByRole('button', { name: 'Back in preview', exact: true }).click()
      await preview.getByRole('button', { name: 'Back in preview', exact: true }).click()
      await preview.getByRole('radio', { name: 'Positive', exact: true }).click()
      await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
      await expect(preview.getByRole('textbox', { name: 'What should we keep doing?', exact: true })).toHaveValue('')
      await preview.getByRole('button', { name: 'Restart preview', exact: true }).click()
      await expect(preview.getByRole('radio', { name: 'Positive', exact: true })).toHaveAttribute('aria-checked', 'false')
      for (const item of flowTemplates) {
        await page.getByLabel('Search templates', { exact: true }).fill(item.title)
        await page.getByLabel('Template category', { exact: true }).selectOption(item.category)
        await page.getByRole('button', { name: item.title, exact: true }).click()
        await expect(preview.getByRole('button', { name: 'Back in preview', exact: true })).toBeDisabled()
        // Traverse the controls the respondent actually receives, through completion.
        for (let screen = 0; screen < 5 && !await preview.getByRole('status').count(); screen++) {
          const text = preview.getByRole('textbox')
          if (await text.count()) {
            if (await text.getAttribute('type') === 'email') {
              await text.fill('synthetic-pencil-invalid')
              await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
              await expect(preview.getByRole('alert')).toBeVisible()
              await text.fill(owner.email)
            } else await text.fill('synthetic-pencil-preview')
          } else if (await preview.getByRole('radio').count()) await preview.getByRole('radio').first().click()
          else {
            await expect(preview.getByLabel('Order summary')).toBeVisible()
            await expect(preview.getByText('Preview never opens Stripe or charges anyone.', { exact: true })).toBeVisible()
            await expect(page.getByRole('note').filter({ hasText: 'Requires Stripe' })).toBeVisible()
            await expect(page.getByRole('note').getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('href', '/app/settings')
            if (item.id === 'payment-event') await page.screenshot({ path: info.outputPath(`${info.project.name}-gallery-payment-preview.png`), fullPage: true })
          }
          await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
        }
        await expect(preview.getByRole('status'), item.id).toHaveText('Preview complete')
        await checkAuthoringLayout(page)
      }
      // Enter in a preview answer belongs to the preview, never the create form.
      const contact = flowTemplates.find(item => item.id === 'lead')!
      await page.getByLabel('Search templates', { exact: true }).fill(contact.title)
      await page.getByLabel('Template category', { exact: true }).selectOption(contact.category)
      await page.getByRole('button', { name: contact.title, exact: true }).click()
      await preview.getByRole('textbox').fill('synthetic-pencil-keyboard')
      await preview.getByRole('textbox').press('Enter')
      await expect(preview.getByRole('textbox', { name: 'What is your email address?', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Your flows', exact: true })).toBeVisible()
      expect(state()).toEqual(before)
      expect(effects).toEqual([])
      expect(await (await page.request.get('/api/app/dashboard')).json()).toEqual([])
    } finally { page.off('request', observe) }
  }
  await page.getByLabel('Search templates', { exact: true }).fill('')
  await page.getByLabel('Template category', { exact: true }).selectOption('All categories')
  await page.getByRole('button', { name: template, exact: true }).click()
  await page.getByRole('button', { name: 'Create draft flow' }).click()
  await expect(page.getByRole('heading', { name: template, exact: true })).toBeVisible()
  const flowId = /flows\/([^/]+)\//.exec(page.url())![1]
  const builderUrl = page.url()
  await checkAuthoringLayout(page)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Share this flow' })).toBeVisible()
  await checkAuthoringLayout(page)
  await expect(page.getByText('Published. New visitors see this version.', { exact: true })).toBeVisible()
  const publicUrl = await page.getByRole('region', { name: 'Share this flow' }).getByLabel('Public link', { exact: true }).inputValue()
  await page.getByRole('button', { name: 'Edit steps', exact: true }).click()
  await checkAuthoringLayout(page)
  await page.screenshot({ path: `test-results/${info.project.name}-${template.replace(/\W/g, '-')}-builder.png`, fullPage: true })
  await page.getByRole('link', { name: 'All flows', exact: true }).click()
  await expect(page.locator('.flow-card').filter({ has: page.getByRole('heading', { name: template, exact: true }) })).toBeVisible()
  await page.getByRole('button', { name: 'New flow', exact: true }).click()
  for (const name of ['Customer feedback', 'NPS', 'Contact/lead']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto(publicUrl)
  await expect(page.locator('.respondent-shell[data-hydrated=true]')).toBeVisible()
  if (template === 'Customer feedback') {
    await page.getByRole('radio', { name: 'Great', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'What could we do better?' }).fill('Synthetic feedback from a customer.')
  } else if (template === 'NPS') {
    await page.getByRole('radio', { name: '9', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'What is the main reason for your score?' }).fill('Synthetic recommendation reason.')
  } else {
    await page.getByRole('textbox', { name: 'What is your name?' }).fill('Synthetic customer')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'What is your email address?' }).fill('customer@example.test')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'How can we help?' }).fill('Synthetic enquiry.')
  }
  // The production admission policy classifies unrealistically fast submissions.
  // Spend a normal reading interval on the final answer, without altering policy.
  await page.waitForTimeout(3200)
  await page.getByRole('button', { name: 'Submit response', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
  const results = await (await page.request.get(`/api/app/flows/${flowId}/results`)).json()
  expect(results.completedResponses).toBe(1)
  await page.goto(builderUrl)
  await page.getByRole('link', { name: 'All flows', exact: true }).click()
  const card = page.locator('.flow-card').filter({ has: page.getByRole('heading', { name: template, exact: true }) })
  await expect(card.getByText('1 response', { exact: false })).toBeVisible()
  await checkAuthoringLayout(page)
  if (template === 'Customer feedback') {
    await page.getByRole('button', { name: 'New flow', exact: true }).click()
    await page.getByLabel('Search templates', { exact: true }).fill('Delivery experience')
    await page.getByLabel('Template category', { exact: true }).selectOption('Customer feedback')
    await page.getByRole('button', { name: 'Delivery experience', exact: true }).click()
    await expect(page.getByText('Positive → What to keep · Needs attention → What to improve')).toBeVisible()
    await page.getByRole('button', { name: 'Create draft flow', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Delivery experience', exact: true })).toBeVisible()
    await checkAuthoringLayout(page)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Share this flow' })).toBeVisible()
    await checkAuthoringLayout(page)
    const branchUrl = await page.getByRole('region', { name: 'Share this flow' }).getByLabel('Public link', { exact: true }).inputValue()
    await page.goto(branchUrl)
    await expect(page.locator('.respondent-shell[data-hydrated=true]')).toBeVisible()
    await page.getByRole('radio', { name: 'Positive', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'What should we keep doing?', exact: true }).fill('Keep the careful delivery updates.')
    const response = page.waitForResponse(response => response.url().endsWith('/responses') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    expect((await response).status()).toBe(201)
    await expect(page.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`${info.project.name}-gallery-branch-response.png`), fullPage: true })
  }
    })
  }
  await test.step('payment template creates an editable priced draft and confirms its payment', async () => {
    await page.goto('/app/')
    await page.getByRole('button', { name: 'New flow', exact: true }).click()
    await page.getByLabel('Search templates', { exact: true }).fill('Paid workshop registration')
    await page.getByRole('button', { name: 'Paid workshop registration', exact: true }).click()
    await expect(page.getByRole('note').filter({ hasText: 'Requires Stripe' })).toBeVisible()
    await page.getByRole('button', { name: 'Create draft flow', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Paid workshop registration', exact: true })).toBeVisible()
    const flowId = /flows\/([^/]+)\//.exec(page.url())![1]
    const base = `/api/app/flows/${flowId}`
    const draft = await (await page.request.get(`${base}/draft`)).json()
    const payment = draft.steps.find((step: any) => step.kind === 'payment')
    expect(payment.questionSettings.payment.products[0].unitAmount).toBe(2500)
    // It is a normal draft: an owner can change its questions before publication.
    const first = draft.steps[0]
    expect((await page.request.put(`${base}/draft`, { data: { expectedVersion: draft.flow.draftVersion, stepId: first.id, prompt: 'Who is attending?', required: true } })).status()).toBe(200)
    await page.reload()
    await expect(page.getByText('Who is attending?', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    const publicUrl = await page.getByRole('region', { name: 'Share this flow' }).getByLabel('Public link', { exact: true }).inputValue()
    expect((await page.request.put('/api/app/connections/payment', { data: { secretKey: stripeFixture.secretKey, webhookSecret: stripeFixture.webhookSecret } })).status()).toBe(200)
    await page.goto(publicUrl)
    await expect(page.locator('.respondent-shell[data-hydrated=true]')).toBeVisible()
    await page.getByRole('textbox', { name: 'Who is attending?', exact: true }).fill('synthetic-pencil-attendee')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const owner = (await (await page.request.get('/auth/session')).json()).operator
    await page.getByRole('textbox', { name: 'What is your email address?', exact: true }).fill(owner.email)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByLabel('Order summary')).toContainText('$25.00')
    expect((await (await page.request.get(`${base}/ledger`)).json()).responses).toHaveLength(0)
    await page.screenshot({ path: info.outputPath(`${info.project.name}-gallery-payment-respondent.png`), fullPage: true })
    await page.waitForTimeout(3200)
    await page.getByRole('button', { name: /Pay.*Stripe/ }).click()
    await expect(page).toHaveURL(new RegExp(`^${stripe.origin}/pay/`))
    const checkout = [...stripe.sessions.values()][0]
    expect(checkout.amount_total).toBe(2500)
    expect((await (await page.request.get(`${base}/ledger`)).json()).responses[0].payment.state).toBe('pending')
    await page.getByRole('button', { name: 'Pay $25.00', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Thank you. Your response has been received.', exact: true })).toBeVisible()
    expect((await (await page.request.get(`${base}/results`)).json()).completedResponses).toBe(1)
    expect((await (await page.request.get(`${base}/ledger`)).json()).responses[0].payment).toMatchObject({ state: 'paid', amount: 2500 })
    expect(stripe.webhooks).toHaveLength(1)
  })
  } finally { await stripe.close() }
})
