import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from './fixtures'
import { openStateDatabase, stateDatabaseFile } from './state-database'
import type { BuilderDraft, PublicFlow } from '../../src/core/app/api'

export const reviewSteps = [
  { kind: 'question', questionType: 'single_choice', prompt: 'Where will we meet?', required: true, choices: [{value:'venue',label:'At the venue'},{value:'delivery',label:'Send a delivery'}] },
  { kind: 'question', questionType: 'long_text', prompt: 'Venue instructions', required: true },
  { kind: 'question', questionType: 'date', prompt: 'Delivery date', required: true, questionSettings: {displayFormat:'DD/MM/YYYY',separator:'.'} },
  { kind: 'question', questionType: 'rating', prompt: 'How confident are you?', required: true, questionSettings: {min:0,max:6,lowLabel:'Not confident',middleLabel:'Somewhat confident',highLabel:'Very confident'} },
]
function door(page: Page, info: TestInfo) {
  return async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST') => {
    const response = await page.request.fetch(path, {method,headers:{Origin:new URL(info.project.use.baseURL!).origin},...(data===undefined?{}:{data})})
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
}
export async function configureReview(page: Page, info: TestInfo, flowId: string) {
  const call=door(page,info), base=`/api/app/flows/${flowId}`, read=()=>call<BuilderDraft>(`${base}/draft`)
  const draft=await read(), [, , route, venue, delivery, scale]=draft.steps
  await call(`${base}/draft`, {expectedVersion:draft.flow.draftVersion,stepId:venue.id,prompt:venue.prompt,required:venue.required,nextStepId:scale.id},'PUT')
  await call(`${base}/draft/branches`, {expectedVersion:(await read()).flow.draftVersion,rules:[{sourceStepId:route.id,predicateKind:'equals',expectedValue:draft.choices.find(choice=>choice.stepId===route.id&&choice.value==='delivery')!.id,destinationStepId:delivery.id,position:0}]},'PUT')
  await page.goto(`/app/flows/${flowId}/builder`)
  await page.getByText('Publication options', {exact:true}).click()
  await page.getByText('Hidden fields and identity', {exact:true}).click()
  await page.getByLabel('Review answers before submitting', {exact:true}).check()
  await page.getByRole('button', {name:'Save hidden fields',exact:true}).click()
  await expect(page.getByText('Saved.', {exact:true})).toBeVisible()
  await page.getByText('Hidden fields and identity', {exact:true}).click()
  await expect(page.getByLabel('Review answers before submitting')).toBeChecked()
  await page.getByLabel('Review answers before submitting').scrollIntoViewIfNeeded()
  await mkdir('docs/evidence',{recursive:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`docs/evidence/resp024-builder-${info.project.name}.png`,fullPage:true})
}
export async function reviewJourney(page: Page, info: TestInfo, flowId: string, slug: string) {
  const call=door(page,info), base=`/api/app/flows/${flowId}`
  const click=async (name: string)=>page.getByRole('button',{name,exact:true}).click()
  await page.getByRole('textbox',{name:'Anything we should know before 07/04/2026?',exact:true}).fill('My own booking details')
  await click('Continue')
  await page.getByRole('radio',{name:'At the venue',exact:true}).click(); await click('Continue')
  await page.getByRole('textbox',{name:'Venue instructions',exact:true}).fill('Use the side entrance'); await click('Continue')
  await page.getByRole('radio',{name:'0 out of 6, Not confident',exact:true}).click(); await click('Review answers')
  await expect(page.getByRole('heading',{name:'Review your answers',exact:true})).toBeFocused()
  const review=page.getByRole('region',{name:'Your answers',exact:true})
  await expect(review.getByRole('definition')).toHaveText(['07/04/2026','My own booking details','At the venue','Use the side entrance','0 — Not confident'])
  await page.screenshot({path:`docs/evidence/resp024-review-before-${info.project.name}.png`,fullPage:true})
  await review.getByRole('link',{name:'Edit Where will we meet?',exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading',{name:'Where will we meet?',exact:true})).toBeFocused()
  await page.getByRole('radio',{name:'Send a delivery',exact:true}).click(); await click('Continue')
  await expect(page.getByRole('heading',{name:'Delivery date',exact:true})).toBeVisible()
  await page.getByLabel('Month',{exact:true}).fill('10'); await page.getByLabel('Day',{exact:true}).fill('20'); await page.getByLabel('Year',{exact:true}).fill('2026')
  await click('Continue'); await page.getByRole('radio',{name:'6 out of 6, Very confident',exact:true}).click(); await click('Review answers')
  const final=['07/04/2026','My own booking details','Send a delivery','20.10.2026','6 — Very confident']
  await expect(review.getByRole('definition')).toHaveText(final)
  await expect(review).not.toContainText('Venue instructions'); await expect(review).not.toContainText('Use the side entrance')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`docs/evidence/resp024-review-after-${info.project.name}.png`,fullPage:true})
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  // Lose the acknowledgement after a real commit, then retry with the same key.
  const submitted: Array<{idempotencyKey:string;answers:Array<{stepId:string;value:unknown}>}>=[]
  await page.route(`**/api/public/flows/${slug}/responses`,async route=>{
    submitted.push(route.request().postDataJSON()); const response=await route.fetch()
    if(submitted.length===1) await route.abort('failed'); else await route.fulfill({response})
  })
  await click('Submit response'); await expect(page.getByRole('button',{name:'Retry submission',exact:true})).toBeVisible(); await click('Retry submission')
  await expect(page.getByRole('heading',{name:'Booked for 07/04/2026',exact:true})).toBeVisible()
  await page.screenshot({path:info.outputPath(`resp024-completed-${info.project.name}.png`),fullPage:true})
  expect(submitted).toHaveLength(2); expect(submitted[0].idempotencyKey).toBeTruthy(); expect(submitted[1]).toEqual(submitted[0])
  await page.unroute(`**/api/public/flows/${slug}/responses`)
  const db=openStateDatabase(stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!))
  try { expect(db.prepare('SELECT idempotency_key FROM responses WHERE flow_id=?').all(flowId)).toEqual([{idempotency_key:submitted[0].idempotencyKey}]) } finally { db.close() }
  // A second anonymous respondent sees only their own answers, no saved identity
  // or first respondent data, and does not submit another response.
  await page.goto(`/f/${slug}`)
  for(const [label,value] of [['Month','08'],['Day','05'],['Year','2026']]) await page.getByLabel(label,{exact:true}).fill(value)
  await click('Continue'); await page.getByRole('textbox',{name:'Anything we should know before 08/05/2026?',exact:true}).fill('A separate respondent'); await click('Continue')
  await page.getByRole('radio',{name:'At the venue',exact:true}).click(); await click('Continue')
  await page.getByRole('textbox',{name:'Venue instructions',exact:true}).fill('Meet in reception'); await click('Continue')
  await page.getByRole('radio',{name:'3 out of 6, Somewhat confident',exact:true}).click(); await click('Review answers')
  await expect(review.getByRole('definition')).toHaveText(['08/05/2026','A separate respondent','At the venue','Meet in reception','3 — Somewhat confident'])
  await expect(review).not.toContainText('My own booking details'); await expect(review).not.toContainText('20.10.2026')
  const draft=await call<BuilderDraft>(`${base}/draft`)
  const copied=await call<{id:string}>(`${base}/duplicate`,{title:'Copied clinic',slug:`copied-${slug}`})
  const template=await call<{id:string}>(`${base}/templates`,{name:'Clinic review',source:'published',expectedVersion:draft.flow.draftVersion})
  const templated=await call<{id:string}>(`/api/app/templates/${template.id}/flows`,{title:'Template clinic',slug:`template-${slug}`})
  for(const copy of [copied,templated]) {
    const copyBase=`/api/app/flows/${copy.id}`, copyDraft=await call<BuilderDraft>(`${copyBase}/draft`)
    expect(copyDraft.formSettings?.reviewBeforeSubmit).toBe(true)
    await call(`${copyBase}/publish`,{expectedVersion:copyDraft.flow.draftVersion})
    expect((await call<PublicFlow>(`/api/public/flows/${copyDraft.flow.slug}`)).reviewBeforeSubmit).toBe(true)
  }
  await call(`${base}/draft/settings`,{expectedVersion:draft.flow.draftVersion,settings:{...draft.formSettings!,reviewBeforeSubmit:false}},'PUT')
  expect((await call<PublicFlow>(`/api/public/flows/${slug}`)).reviewBeforeSubmit).toBe(true)
}
