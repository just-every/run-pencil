import { expect, test } from './fixtures'
import { checkAuthoringLayout, signInEmptyWorkspace } from './authoring-helpers'

for (const template of ['Customer feedback', 'NPS', 'Contact/lead']) test(`${template}: empty dashboard to publication, response and counted result`, async ({ page }, info) => {
  test.setTimeout(90_000)
  await signInEmptyWorkspace(page)
  for (const name of ['Customer feedback', 'NPS', 'Contact/lead']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
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
  await expect(card.getByText('1 completed · 1 starts', { exact: true })).toBeVisible()
  await checkAuthoringLayout(page)
})
