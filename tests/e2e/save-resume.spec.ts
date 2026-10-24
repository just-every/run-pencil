import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { contract } from './contract'
import type { Page } from '@playwright/test'
import { expect, openMailLink, test } from './fixtures'
import { operatorEmail } from './auth-identity'
import { appHeaders } from './api-headers'
import { testDevKey } from '../helpers/dev-key.mjs'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'

async function inspectState(page: Page, name: string, project: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  expect(await page.evaluate(() => {
    const title = document.querySelector('h1')!.getBoundingClientRect()
    return document.documentElement.scrollWidth <= innerWidth && title.left >= 0 && title.right <= innerWidth
  }), `The ${name} state fits the viewport.`).toBe(true)
  if (process.env.PENCIL_CAPTURE_DIR) {
    await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${name}-${project}.png`), fullPage: true })
  }
}

contract(['PART-002','RSLT-013'], 'a respondent saves two answers, resumes privately on another device and sees completion on reuse', async ({ page, browser }, info) => {
  test.setTimeout(120_000)
  const email = operatorEmail()
  await page.goto('/signin'); await page.getByLabel('Operator email').fill(email)
  await page.getByRole('button', { name: /Send.*link/i }).click()
  await openMailLink(page, email); await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  const call = async <T,>(path: string, data?: unknown): Promise<T> => {
    const response = data === undefined ? await page.request.get(path) : await page.request.post(path, { headers: appHeaders, data })
    expect(response.ok(), path).toBe(true)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  const slug = `client-intake-${info.project.name}-${Date.now()}`
  const flow = await call<{id:string}>('/api/app/flows', { title: 'Harbour Studio client intake', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(`${path}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'short_text', prompt: 'What is your name?', required: true },
    { kind: 'question', questionType: 'email', prompt: 'What is your work email?', required: true },
    { kind: 'question', questionType: 'long_text', prompt: 'Tell us about your project.', required: true },
    { kind: 'completion', questionType: null, prompt: 'Your project brief is with us.' },
  ]) await call(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })
  const editable=await draft()
  expect((await page.request.put(`${path}/draft/settings`,{headers:appHeaders,data:{expectedVersion:editable.flow.draftVersion,settings:{...editable.formSettings!,responseEdits:{enabled:true,deadline:new Date(Date.now()+86400000).toISOString()},confirmation:{enabled:true,includeAnswers:false,answerTypes:[],emailStepId:editable.steps[1].id,subject:'Response received',body:'Thank you.'}}}})).ok()).toBe(true)
  await call(`${path}/publish`, { expectedVersion: (await draft()).flow.draftVersion })
  const original=await call<{revision:{id:string}}>(`/api/public/flows/${slug}`)
  const origin = new URL(page.url()).origin
  const firstContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport, extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.182.10' } })
  const otherContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport, extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.182.11' } })
  try {
    const first = await firstContext.newPage()
    await first.goto(`/f/${slug}`)
    await first.getByRole('textbox', { name: 'What is your name?' }).fill('Jo Taylor')
    await first.getByRole('button', { name: 'Continue', exact: true }).click()
    await first.getByRole('textbox', { name: 'What is your work email?' }).fill('jo@harbour.example')
    await first.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(first.getByRole('heading', { name: 'Tell us about your project.' })).toBeVisible()
    await first.getByRole('button', { name: 'Save and finish later' }).click()
    const resumeEmail = `resume-${info.project.name}@example.test`
    await first.getByLabel('Email for your resume link').fill(resumeEmail)
    await inspectState(first, 'save-panel', info.project.name)
    await first.getByRole('button', { name: 'Email resume link' }).click()
    await expect(first.getByRole('status')).toContainText('Your answers are saved.')
    await inspectState(first, 'save', info.project.name)
    const captured = await page.request.get('/__test/mail', { headers: { 'x-rer-dev-key': testDevKey } }).then(response => response.json())
    const message = captured.messages.find((message: {to:string|Array<string|{email:string}>}) => (Array.isArray(message.to) ? message.to : [message.to]).some(to => (typeof to === 'string' ? to : to.email) === resumeEmail))
    const link = /https?:\/\/[^\s]+[?&]resume=[a-f0-9]{64}/.exec(message?.text ?? '')?.[0]
    expect(Boolean(link), 'The paid-mail receiver captured one private resume link.').toBe(true)
    expect(new URL(link!).origin === origin, 'The emailed link uses this installation origin.').toBe(true)
    const target = link!
    expect((await call<Ledger>(`${path}/ledger`)).total).toBe(0)
    // A later publication must not reinterpret the saved answers.
    await call(`${path}/publish`, { expectedVersion: (await draft()).flow.draftVersion })
    const resumed = await otherContext.newPage()
    const resumeDocument = await resumed.goto(target).catch(() => { throw new Error('The private emailed resume link could not load.') })
    expect(resumeDocument!.headers()['x-robots-tag']).toBe('noindex')
    await expect(resumed.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    expect(await resumed.locator('head').textContent()).not.toContain('jo@harbour.example')
    await expect(resumed.getByRole('heading', { name: 'Tell us about your project.' })).toBeVisible()
    await resumed.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(resumed.getByRole('textbox', { name: 'What is your work email?' })).toHaveValue('jo@harbour.example')
    await resumed.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(resumed.getByRole('textbox', { name: 'What is your name?' })).toHaveValue('Jo Taylor')
    await resumed.getByRole('button', { name: 'Continue', exact: true }).click()
    await resumed.getByRole('button', { name: 'Continue', exact: true }).click()
    await resumed.getByRole('textbox', { name: 'Tell us about your project.' }).fill('We need a booking site for our new studio.')
    await inspectState(resumed, 'resume', info.project.name)
    // The minimum now measures this device's signed document load, not the old session.
    await resumed.waitForTimeout(3100)
    await resumed.getByRole('button', { name: 'Submit response' }).click()
    await expect(resumed.getByRole('heading', { name: 'Your project brief is with us.' })).toBeVisible()
    await resumed.goto(target).catch(() => { throw new Error('The private emailed resume link could not load.') })
    await expect(resumed.getByRole('heading', { name: 'Your project brief is with us.' })).toBeVisible()
    await expect(resumed.getByRole('button', { name: 'Save and finish later' })).toHaveCount(0)
    const ledger = await call<Ledger>(`${path}/ledger`)
    expect(ledger.total).toBe(1)
    const traffic=await call<{totals:{views:number;starts:number;submissions:number}}>(`${path}/traffic?revisionId=${original.revision.id}`)
    expect(traffic.totals).toEqual({views:2,starts:1,submissions:1})
    expect(ledger.responses[0].participant).toBeUndefined()
    expect(JSON.stringify(ledger.responses)).not.toContain(resumeEmail)
    expect(ledger.responses[0].answers.map(answer => answer.value)).toEqual(['Jo Taylor', 'jo@harbour.example', 'We need a booking site for our new studio.'])
    await inspectState(resumed, 'completed', info.project.name)
    await resumed.goto(`/f/${slug}?resume=${'0'.repeat(64)}`)
    await expect(resumed.getByRole('heading', { name: 'This resume link is no longer available.' })).toBeVisible()
    await expect(resumed.getByRole('link', { name: 'Start again' })).toHaveAttribute('href', `/f/${slug}`)
    await inspectState(resumed, 'unavailable', info.project.name)
    expect((await call<{totals:unknown}>(`${path}/traffic?revisionId=${original.revision.id}`)).totals).toEqual(traffic.totals)
    const draftSlug = `private-${slug}`
    await call('/api/app/flows', { title: 'Unpublished catering draft', slug: draftSlug })
    const privateDraft = await otherContext.request.get(`/f/${draftSlug}?resume=${'0'.repeat(64)}`)
    expect(privateDraft.status()).toBe(404)
    // RESP-021 shares this existing respondent journey: settings, prefilled editing and retained ledger versions.
    const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
    await page.goto(`/app/flows/${flow.id}/builder`)
    await expect(page.locator('.flow-authoring')).toBeVisible()
    await page.getByRole('complementary',{name:'Flow steps'}).getByRole('button',{name:/Your project brief/}).click()
    const editSettings=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Edit after submission'})})
    await editSettings.locator('summary').click()
    await expect(editSettings.getByLabel('Allow response editing')).toBeChecked()
    await editSettings.getByRole('button',{name:'Save editing settings'}).click()
    await expect(page.getByText('Editing settings saved. Publish to apply.',{exact:true})).toBeVisible()
    await editSettings.locator('summary').click()
    await expect(editSettings.getByLabel('Allow response editing')).toBeChecked()
    await inspectState(page,'edit-settings',info.project.name)
    const mail=await page.request.get('/__test/mail',{headers:{'x-rer-dev-key':testDevKey}}).then(response=>response.json())
    const receipt=mail.messages.find((message:{text?:string})=>message.text?.includes('?edit='))
    const editLink=/https?:\/\/[^\s]+[?&]edit=[a-f0-9]{64}/.exec(receipt?.text??'')?.[0]
    expect(editLink,'The permitted confirmation carries a private edit link.').toBeTruthy()
    await page.goto(editLink!)
    await expect(page.getByRole('textbox',{name:'What is your name?'})).toHaveValue('Jo Taylor')
    await page.getByRole('textbox',{name:'What is your name?'}).fill('Jo Updated')
    await inspectState(page,'edit-prefilled',info.project.name)
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await expect(page.getByRole('textbox',{name:'What is your work email?'})).toHaveValue('jo@harbour.example')
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await expect(page.getByRole('textbox',{name:'Tell us about your project.'})).toHaveValue('We need a booking site for our new studio.')
    await page.getByRole('button',{name:'Review answers',exact:true}).click()
    await expect(page.getByRole('region',{name:'Your answers'})).toContainText('Jo Updated')
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Your project brief is with us.'})).toBeVisible()
    expect((await call<{totals:unknown}>(`${path}/traffic?revisionId=${original.revision.id}`)).totals).toEqual(traffic.totals)
    await page.goto(editLink!)
    await expect(page.getByRole('alert')).toContainText(/expired|used|unavailable/)
    await page.goto(`/app/flows/${flow.id}/results`)
    await page.getByRole('combobox',{name:'Published revision',exact:true}).selectOption(original.revision.id)
    await page.getByRole('button',{name:'View answers',exact:true}).click()
    await page.getByText('Response versions (2)',{exact:true}).click()
    await expect(page.getByRole('region',{name:'Version 2 current'})).toContainText('Jo Updated')
    await expect(page.getByRole('region',{name:'Version 1',exact:true})).toContainText('Jo Taylor')
    const downloadStarted=page.waitForEvent('download')
    await page.getByRole('link',{name:'Download version history',exact:true}).click()
    const versionDownload=await downloadStarted
    expect(versionDownload.suggestedFilename()).toBe(`pencil-response-${ledger.responses[0].id}-versions.jsonl`)
    const stream=await versionDownload.createReadStream()
    expect(stream).toBeTruthy()
    let bytes=''
    for await(const chunk of stream!)bytes+=chunk.toString()
    const [historyHeader,...versions]=bytes.trim().split('\n').map(line=>JSON.parse(line))
    expect(historyHeader).toMatchObject({format:'pencil.response-history.v1',responseId:ledger.responses[0].id,currentVersion:2,retainedVersions:2})
    expect(versions).toHaveLength(2)
    expect(versions[0]).toMatchObject({number:2,current:true,answers:expect.arrayContaining([{stepId:editable.steps[0].id,value:'Jo Updated'}])})
    expect(versions[1]).toMatchObject({number:1,current:false,answers:expect.arrayContaining([{stepId:editable.steps[0].id,value:'Jo Taylor'}])})
    await inspectState(page,'ledger-versions',info.project.name)
    if(process.env.PENCIL_CAPTURE_DIR)await page.getByRole('region',{name:'Version 2 current'}).locator('..').screenshot({path:join(process.env.PENCIL_CAPTURE_DIR,`versions-detail-${info.project.name}.png`)})
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])

  } finally { await firstContext.close(); await otherContext.close() }
})
