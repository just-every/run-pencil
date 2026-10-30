import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace, addStep } from './authoring-helpers'
import { downloadedText, csvRows } from './export-helpers'

contract('FIELD-003', 'builds and collects satisfaction, effort, emoji and thumbs scores with stated results and numeric exports', async ({ page }, info) => {
  test.setTimeout(120_000)
  await signInEmptyWorkspace(page)
  await page.getByRole('button', { name: 'Blank flow', exact: true }).click()
  const title = `Workshop satisfaction ${info.project.name}`
  await page.getByLabel('Flow name').fill(title)
  await page.getByRole('button', { name: 'Create draft flow' }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  const flowId = /flows\/([^/]+)\//.exec(page.url())![1]
  const rail = page.getByRole('complementary', { name: 'Flow steps' })
  const editor = page.getByRole('complementary', { name: 'Step settings' })
  const questions = [
    ['csat', 'How satisfied were you with the workshop?', '5, Very satisfied'],
    ['ces', 'How easy was it to book your place?', '7, Very easy'],
    ['emoji_rating', 'How do you feel about the workshop?', '4, Satisfied'],
    ['thumbs_rating', 'Would you recommend this workshop?', 'Thumbs down'],
  ] as const
  const save = async () => {
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
  }
  for (const [type, prompt] of questions) {
    await addStep(rail, 'Add question')
    await editor.getByLabel('Question type').selectOption(type)
    await editor.getByLabel('Prompt', { exact: true }).fill(prompt)
    await editor.getByLabel('Required response').check()
    await save()
    await expect(page.getByLabel('Draft question canvas').getByRole('radiogroup', { name: prompt })).toBeVisible()
  }
  await page.screenshot({ path: `test-results/${info.project.name}-scores-builder.png`, fullPage: true })
  await addStep(rail, 'Add completion screen')
  await editor.getByLabel('Prompt', { exact: true }).fill('Thank you for helping us improve the next workshop.')
  await save()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const publicUrl = await page.getByRole('region', { name: 'Share this flow' }).getByLabel('Public link', { exact: true }).inputValue()
  await page.goto(publicUrl)
  for (const [index, [, prompt, answer]] of questions.entries()) {
    await expect(page.getByRole('heading', { name: prompt })).toBeVisible()
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
    await page.getByRole('button', { name: index === 3 ? 'Submit response' : 'Continue', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('radio', { name: answer, exact: true }).focus()
    await page.keyboard.press('Space')
    await expect(page.getByRole('radio', { name: answer, exact: true })).toHaveAttribute('aria-checked', 'true')
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/${info.project.name}-scores-${index}.png`, fullPage: true })
    if (index === 3) await page.waitForTimeout(3200)
    await page.getByRole('button', { name: index === 3 ? 'Submit response' : 'Continue', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'Thank you for helping us improve the next workshop.' })).toBeVisible()
  await page.goto(`/app/flows/${flowId}/results`)
  await expect(page.getByText('1 satisfied answers (4–5) / 1 answers', { exact: true })).toBeVisible()
  await expect(page.getByText('7 total score / 1 answers · scale 1–7', { exact: true })).toBeVisible()
  await expect(page.getByText('CSAT 100%', { exact: true })).toBeVisible()
  await expect(page.getByText('Mean customer effort 7', { exact: true })).toBeVisible()
  const thumbs = page.locator('.question-card').filter({ has: page.getByRole('heading', { name: questions[3][1] }) })
  await expect(thumbs.getByText('Thumbs down', { exact: true })).toBeVisible()
  await expect(thumbs.getByText('1 of 1 answer · 100%', { exact: true })).toBeVisible()
  await page.screenshot({ path: `test-results/${info.project.name}-scores-results.png`, fullPage: true })
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  const download = page.waitForEvent('download')
  await ledger.getByRole('button', { name: 'Export JSON' }).click()
  const json = JSON.parse(await downloadedText(await download))
  expect(json.responses).toHaveLength(1)
  expect(json.responses[0].answers.map((answer: { value: unknown }) => answer.value)).toEqual([5, 7, 4, false])
  const csvDownload = page.waitForEvent('download')
  await ledger.getByRole('button', { name: 'Export CSV' }).click()
  const csv = csvRows(await downloadedText(await csvDownload))
  expect(csv[1][0]).toBe(json.responses[0].id)
  expect(JSON.parse(csv[1][8]).map((answer: { value: unknown }) => answer.value)).toEqual([5, 7, 4, false])
})
