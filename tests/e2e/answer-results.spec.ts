import { operatorDisclosureExposure } from './disclosure-exposure'
import { appHeaders } from './api-headers'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { operatorEmail } from './auth-identity'
import { contract } from './contract'
import { expect, test, openMailLink } from './fixtures'
import AxeBuilder from '@axe-core/playwright'
import { collectAnswerScenario, type ScenarioCall } from '../results-scenario'
contract(['RSLT-001', 'RSLT-002', 'RSLT-003', 'RSLT-004', 'RSLT-005', 'RSLT-006', 'LEDG-001', 'DATA-002', 'BASE-PUBLIC-003'], 'answers first across every type, an RSLT-006 crosstab states shares and suppression, comparison replaces results and ledger confirms erasure', async ({ page }, info) => {
  test.setTimeout(180000)
  const hydrationErrors:string[]=[]
  page.on('pageerror',error=>{if(/hydrat/i.test(error.message))hydrationErrors.push(error.message)})
  page.on('console',message=>{if(message.type()==='error' && /hydrat/i.test(message.text()))hydrationErrors.push(message.text())})
  const capture = async (name: string) => {
    if (!process.env.PENCIL_CAPTURE_DIR) return
    await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${info.project.name}-results-${name}.png`), fullPage: true })
    if (name === 'operator-exposure') await page.locator('section.crosstab').screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${info.project.name}-results-exposure-note.png`) })
  }
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  const email = operatorEmail()
  await page.goto('/signin'); await page.getByLabel('Operator email').fill(email)
  await page.getByRole('button', { name: /Send.*link/i }).click()
  await openMailLink(page, email)
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  let serial = 0
  const call: ScenarioCall = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
    const response = await page.request.fetch(path, { method, headers: { ...appHeaders, 'CF-Connecting-IP': `198.18.165.${++serial % 250}` }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeLessThan(300)
    expect(response.status(), path).toBeGreaterThanOrEqual(200)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  const scenario = await collectAnswerScenario(call, `answers-${info.project.name}-${Date.now()}`)
  expect(scenario.questions).toHaveLength(13)
  expect(scenario.questions.every(question => question.answered === 12)).toBe(true)
  await page.goto(`/app/flows/${scenario.flow.id}/results`)
  await page.getByLabel('Published revision').selectOption(scenario.revisionId)
  const answers = page.getByRole('region', { name: 'Answers', exact: true })
  await expect(answers.getByRole('heading', { level: 3 })).toHaveCount(13)
  expect(await answers.boundingBox().then(box => box!.y)).toBeLessThan(await page.getByText('Completion rate', { exact: true }).boundingBox().then(box => box!.y))
  await expect(page.getByText(/AI analysis and external task delivery are unavailable/)).toHaveCount(0)
  expect(await page.locator('.operator-content').innerText()).not.toMatch(/\b[0-9A-HJKMNP-TV-Z]{26}\b/)
  for (const card of await answers.locator('article').all()) {
    const cardWidth = await card.evaluate(element => element.clientWidth - parseFloat(getComputedStyle(element).paddingLeft) - parseFloat(getComputedStyle(element).paddingRight))
    for (const bar of await card.locator('.device-bar').all()) expect((await bar.boundingBox())!.width).toBeGreaterThanOrEqual(cardWidth / 2)
  }
  const text = answers.locator('article').filter({ has: page.getByRole('heading', { name: 'Question long_text', exact: true }) })
  await text.getByRole('searchbox').fill('answer 0'); await expect(text.getByText('Exact retained answer 0', { exact: true })).toBeVisible()
  await text.getByRole('searchbox').fill(''); await text.getByRole('button', { name: 'Show more answers' }).click()
  await expect(text.getByText('Exact retained answer 0', { exact: true })).toBeVisible()
  await capture('summary')

  const responseFilters = page.getByRole('region',{name:'Response ledger'})
  const yesNo = scenario.questions.find(question => question.questionType === 'yes_no')!
  await responseFilters.getByRole('combobox',{name:'Question, hidden field or calculation',exact:true}).selectOption(yesNo.id)
  await responseFilters.getByLabel('Answer contains / equals').selectOption('true')
  const devices = page.locator('.device-card')
  await expect(devices.getByRole('heading',{name:'Responses by device class'})).toBeVisible()
  await expect(devices).toContainText('6 filtered native responses')
  await expect(devices.locator('.device-row').filter({hasText:'desktop'})).toContainText('6 / 6 · 100%')
  await expect(devices.locator('.device-row').filter({hasText:'mobile'})).toContainText('0 / 6 · 0%')
  await responseFilters.getByLabel('Device class',{exact:true}).selectOption('mobile')
  await expect(devices).toContainText('0 filtered native responses')
  await responseFilters.getByLabel('Device class',{exact:true}).selectOption('')
  await responseFilters.getByLabel('Answer contains / equals').selectOption('false')
  await expect(devices.locator('.device-row').filter({hasText:'mobile'})).toContainText('6 / 6 · 100%')
  await page.getByLabel('Published revision').selectOption('')
  await expect(page.locator('.device-card')).toContainText('0 filtered native responses')
  await page.getByLabel('Published revision').selectOption(scenario.revisionId)
  await expect(page.locator('.device-card').locator('.device-row').filter({hasText:'mobile'})).toContainText('6 / 6 · 100%')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({page}).include('.operator-content').analyze()).violations.filter(violation=>violation.impact==='serious'||violation.impact==='critical')).toEqual([])
  expect(hydrationErrors).toEqual([])
  await capture('device-filtered')
  if(process.env.PENCIL_CAPTURE_DIR) {
    await page.locator('.device-card').screenshot({path:join(process.env.PENCIL_CAPTURE_DIR,`${info.project.name}-device-filtered.png`)})
    await responseFilters.screenshot({path:join(process.env.PENCIL_CAPTURE_DIR,`${info.project.name}-ledger-device-filtered.png`)})
  }
  await responseFilters.getByRole('combobox',{name:'Question, hidden field or calculation',exact:true}).selectOption('')
  await expect(page.locator('.device-card').getByRole('heading',{name:'Starts by device class'})).toBeVisible()
  await expect(page.locator('.device-card')).toContainText('12 recorded starts')

  const crosstab = page.locator('section.crosstab')
  await crosstab.getByRole('combobox', { name: 'Rows', exact: true }).selectOption({ label: 'Question single_choice' })
  await crosstab.getByRole('combobox', { name: 'Columns', exact: true }).selectOption({ label: 'Question yes_no' })
  await crosstab.getByRole('button', { name: 'Cross', exact: true }).click()
  const table = crosstab.getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveText(['Question single_choice', 'Yes', 'No', 'Row total'])
  // Coffee answered Yes six times and Tea No six times; the empty cells are below the default threshold of 5.
  await expect(table.getByRole('row', { name: /^Coffee/ })).toContainText('6Row withheldColumn withheld')
  await expect(table.getByRole('row', { name: /^Coffee/ }).getByText('suppressed', { exact: true })).toBeVisible()
  await expect(table.getByRole('row', { name: /^Column total/ })).toHaveText(/withheld.*withheld.*withheld/)
  await expect(crosstab.getByText(/2 cells have fewer than 5 responses and are suppressed \(ANLY-005\)/)).toBeVisible()
  await expect(crosstab.getByText('Chi-square is withheld because a suppressed cell could be recovered from it.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).include('.crosstab').analyze()).violations).toEqual([])
  if (process.env.PENCIL_CAPTURE_DIR) await crosstab.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${info.project.name}-results-crosstab.png`) })
  const select = await page.getByLabel('Published revision').boundingBox()
  const compare = page.getByRole('button', { name: 'Compare revisions', exact: true })
  const button = await compare.boundingBox(); expect(button!.y - (select!.y + select!.height)).toBeGreaterThanOrEqual(12)
  await compare.click(); await expect(page.getByRole('heading', { name: 'Compare revisions', exact: true })).toBeVisible()
  expect(await page.locator('.operator-content').innerText()).not.toMatch(/\b[0-9A-HJKMNP-TV-Z]{26}\b/)
  if (info.project.name === 'mobile') for (const version of await page.locator('#revision-comparison section[aria-label]').all()) {
    const bounds = await version.boundingBox()
    const parentWidth = await version.evaluate(element => element.parentElement!.getBoundingClientRect().width)
    expect(bounds!.width).toBeGreaterThanOrEqual(parentWidth - 1)
  }
  await expect(answers).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Response ledger' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).include('.operator-content').analyze()).violations).toEqual([])
  await capture('comparison')
  await page.getByRole('button', { name: 'Back to results' }).click(); await expect(answers).toBeVisible()
  await expect(page.getByLabel('Email me about completed responses')).toHaveValue('immediately')
  await page.getByLabel('Email me about completed responses').selectOption('off')
  await expect(page.getByText('Your notification preference is saved.')).toBeVisible()
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  await expect(ledger.getByRole('button', { name: 'View answers', exact: true })).toHaveCount(12)
  await ledger.getByRole('button', { name: 'View answers', exact: true }).first().click()
  await expect(ledger.locator('.ledger-answer')).toHaveCount(13)
  for (const control of await ledger.getByRole('button', { name: /Previous responses|Next responses/ }).all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await ledger.getByRole('button', { name: 'Erase response', exact: true }).click()
  await expect(ledger.getByRole('alert')).toContainText(/all its answers and pending effects/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).include('.operator-content').analyze()).violations).toEqual([])
  await capture('erase-confirmation')
  await ledger.getByRole('button', { name: 'Keep response' }).click()
  await expect(ledger.getByText('12 matching completed responses', { exact: false })).toBeVisible()
  await ledger.getByRole('button', { name: 'Erase response', exact: true }).click(); await ledger.getByRole('button', { name: 'Confirm erasure' }).click()
  await expect(ledger.getByText('11 matching completed responses', { exact: false })).toBeVisible()
  await capture('after-erasure')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).include('.operator-content').analyze()).violations).toEqual([])
  await operatorDisclosureExposure(page, call, `disclosure-${info.project.name}-${Date.now()}`, capture)
})
