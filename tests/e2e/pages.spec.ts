import AxeBuilder from '@axe-core/playwright'
import type { BuilderDraft } from '../../src/core/app/api'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

contract('FIELD-008','builds three classic pages, edits in-page visibility and completes with hidden required answers discarded',async({page},info)=>{
  test.setTimeout(120_000)
  page.setDefaultTimeout(15_000)
  await signInEmptyWorkspace(page)
  const slug=`installation-request-${info.project.name}-${Date.now()}`
  const call=async<T,>(path:string,method='GET',data?:unknown)=>{
    const response=await page.request.fetch(path,{method,...(data===undefined?{}:{data})})
    expect(response.status(),await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const flow=await call<{id:string}>('/api/app/flows','POST',{title:'Office installation request',slug})
  const base=`/api/app/flows/${flow.id}`, read=()=>call<BuilderDraft>(`${base}/draft`)
  for(const step of [
    {kind:'question',questionType:'yes_no',prompt:'Need installation?',required:true},
    {kind:'question',questionType:'short_text',prompt:'Installation address',required:true},
    {kind:'question',questionType:'number',prompt:'Number of locations',required:false},
    {kind:'question',questionType:'short_text',prompt:'Project name',required:true},
    {kind:'question',questionType:'email',prompt:'Work email',required:false},
    {kind:'question',questionType:'consent',prompt:'Confirm request',required:true,questionSettings:{statement:'Please contact me about this request.'}},
    {kind:'completion',questionType:null,prompt:'Request received'},
  ])await call(`${base}/draft/steps`,'POST',{expectedVersion:(await read()).flow.draftVersion,step})
  const draft=await read(),[install,address,quantity,project,email,consent]=draft.steps
  await page.goto(`/app/flows/${flow.id}/builder`)
  const rail=page.getByRole('complementary',{name:'Flow steps'}), inspector=page.getByRole('complementary',{name:'Step settings'})
  for(const [head,last,title] of [[install,quantity,'Services'],[project,email,'Project details'],[consent,consent,'Confirmation']] as const){
    await rail.getByRole('button',{name:new RegExp(head.prompt.replace('?','\\?'))}).click()
    await inspector.getByText('Screen layout and visibility',{exact:true}).click()
    await inspector.getByLabel('Layout',{exact:true}).selectOption('page')
    await inspector.getByLabel('Screen title',{exact:true}).fill(title)
    await inspector.getByLabel('Screen description',{exact:true}).fill(title==='Services'?'Tell us which services your office needs.':'Review the details for your request.')
    await inspector.getByLabel('Last included question',{exact:true}).selectOption(last.id)
    await inspector.getByRole('button',{name:'Save screen layout',exact:true}).click()
    await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  }
  await rail.getByRole('button',{name:/Installation address/}).click()
  await inspector.getByText('Screen layout and visibility',{exact:true}).click()
  await inspector.getByRole('checkbox',{name:'Show this question conditionally'}).check()
  await inspector.getByLabel('Question',{exact:true}).selectOption(install.id)
  await inspector.getByLabel('Condition',{exact:true}).selectOption('equals')
  await inspector.getByLabel('Answer',{exact:true}).selectOption('true')
  await page.screenshot({path:`test-results/${info.project.name}-pages-editor.png`,fullPage:true})
  await inspector.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  await page.screenshot({path:`test-results/${info.project.name}-pages-builder.png`,fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByRole('button',{name:'Preview draft',exact:true}).click()
  const preview=page.getByRole('region',{name:'Draft preview',exact:true})
  await expect(preview.getByRole('heading',{name:'Services',exact:true})).toBeVisible()
  await preview.getByRole('group',{name:'Need installation?',exact:true}).getByRole('radio',{name:'No',exact:true}).click()
  await expect(preview.getByRole('textbox',{name:'Installation address',exact:true})).toHaveCount(0)
  await page.screenshot({path:`test-results/${info.project.name}-pages-preview.png`,fullPage:true})
  await preview.getByRole('button',{name:'Continue preview',exact:true}).click()
  await expect(preview.getByRole('heading',{name:'Project details',exact:true})).toBeVisible()
  await preview.getByRole('button',{name:'Close preview',exact:true}).click()
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  await expect(page.getByRole('region',{name:'Share this flow'})).toBeVisible()
  await page.goto(`/f/${slug}`)
  await expect(page.getByRole('heading',{name:'Services',exact:true})).toBeVisible()
  await page.getByRole('group',{name:'Need installation?',exact:true}).getByRole('radio',{name:'Yes',exact:true}).click()
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Installation address')
  await page.getByRole('textbox',{name:'Installation address',exact:true}).fill('45 Market Street')
  await page.getByRole('spinbutton',{name:'Number of locations',exact:true}).fill('2')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Project details',exact:true})).toBeVisible()
  await expect(page.getByRole('progressbar',{name:'Response progress'})).toHaveAttribute('aria-valuenow','33')
  await expect(page.getByText('2 remaining',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Back',exact:true}).click()
  await page.getByRole('group',{name:'Need installation?',exact:true}).getByRole('radio',{name:'No',exact:true}).click()
  await expect(page.getByRole('textbox',{name:'Installation address',exact:true})).toHaveCount(0)
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/${info.project.name}-pages-conditional.png`,fullPage:true})
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Westside office move')
  await page.getByRole('textbox',{name:'Work email',exact:true}).fill('jo@westside.example')
  await page.screenshot({path:`test-results/${info.project.name}-pages-details.png`,fullPage:true})
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('checkbox',{name:'Confirm request',exact:true}).check()
  await page.screenshot({path:`test-results/${info.project.name}-pages-confirmation.png`,fullPage:true})
  await page.waitForTimeout(3200)
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Request received',exact:true})).toBeVisible()
  await page.screenshot({path:`test-results/${info.project.name}-pages-completed.png`,fullPage:true})
  const ledger=await call<{total:number;responses:Array<{id:string}>}>(`${base}/ledger`)
  expect(ledger.total).toBe(1)
  const text=JSON.stringify(ledger)
  expect(text).not.toContain('45 Market Street')
})
