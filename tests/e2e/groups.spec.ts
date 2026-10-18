import AxeBuilder from '@axe-core/playwright'
import type { BuilderDraft } from '../../src/core/app/api'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { questionGroupDefinition } from '../fixtures/question-groups'

contract('FIELD-012','builds and collects a required three-question group, branches on a grouped answer and reviews imported groups',async({page},info)=>{
  test.setTimeout(120_000);page.setDefaultTimeout(15_000)
  await signInEmptyWorkspace(page)
  const slug=`team-consultation-${info.project.name}-${Date.now()}`
  const call=async<T,>(path:string,method='GET',data?:unknown)=>{
    const response=await page.request.fetch(path,{method,...(data===undefined?{}:{data})})
    expect(response.status(),await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const flow=await call<{id:string}>('/api/app/flows','POST',{title:'Team consultation',slug})
  const base=`/api/app/flows/${flow.id}`,read=()=>call<BuilderDraft>(`${base}/draft`)
  for(const step of [
    {kind:'question',questionType:'short_text',prompt:'Your name',required:true},
    {kind:'question',questionType:'number',prompt:'Team size',required:false},
    {kind:'question',questionType:'yes_no',prompt:'Ready to talk?',required:false},
    {kind:'completion',questionType:null,prompt:'Request received'},
    {kind:'completion',questionType:null,prompt:'Book your team consultation'},
  ])await call(`${base}/draft/steps`,'POST',{expectedVersion:(await read()).flow.draftVersion,step})
  const draft=await read(),[name,size,ready,,book]=draft.steps
  await page.goto(`/app/flows/${flow.id}/builder`)
  const rail=page.getByRole('complementary',{name:'Flow steps'}),settings=page.getByRole('complementary',{name:'Step settings'})
  await settings.getByText('Screen layout and visibility',{exact:true}).click()
  await settings.getByLabel('Layout',{exact:true}).selectOption('group')
  await settings.getByLabel('Screen title',{exact:true}).fill('Your team')
  await settings.getByLabel('Screen description',{exact:true}).fill('Tell us about the people who will use the service.')
  await settings.getByLabel('Last included question',{exact:true}).selectOption(ready.id)
  await page.screenshot({path:`test-results/${info.project.name}-groups-builder.png`,fullPage:true})
  await settings.getByRole('button',{name:'Save screen layout',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  await rail.getByRole('button',{name:/Ready to talk/}).click()
  await settings.getByRole('button',{name:'Add condition rule',exact:true}).click()
  const rule=settings.getByRole('group',{name:'Rule 1',exact:true})
  await rule.getByLabel('Question',{exact:true}).selectOption(size.id)
  await rule.getByLabel('Condition',{exact:true}).selectOption('greater_than_or_equal')
  await rule.getByLabel('Value',{exact:true}).fill('50')
  await rule.getByLabel('Then go to',{exact:true}).selectOption(book.id)
  await settings.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  await expect(page.getByRole('region',{name:'Share this flow'})).toBeVisible()
  for(const [teamSize,end] of [[75,'Book your team consultation'],[10,'Request received']] as const){
    await page.goto(`/f/${slug}`)
    await expect(page.getByRole('heading',{name:'Your team',exact:true})).toBeVisible()
    await expect(page.getByText('3 remaining',{exact:true})).toBeVisible()
    await expect(page.getByRole('textbox',{name:'Your name',exact:true})).toBeVisible()
    await expect(page.getByRole('spinbutton',{name:'Team size',exact:true})).toBeVisible()
    await expect(page.getByRole('radiogroup',{name:'Ready to talk?',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(page.getByRole('alert')).toContainText('Your name')
    await page.getByRole('textbox',{name:'Your name',exact:true}).fill('Jo West')
    await page.getByRole('spinbutton',{name:'Team size',exact:true}).fill(String(teamSize))
    await page.getByRole('radio',{name:'Yes',exact:true}).focus();await page.keyboard.press('Space')
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:`test-results/${info.project.name}-groups-${teamSize}.png`,fullPage:true})
    await page.waitForTimeout(3200)
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(page.getByRole('heading',{name:end,exact:true})).toBeVisible()
    await page.screenshot({path:`test-results/${info.project.name}-groups-completed-${teamSize}.png`,fullPage:true})
  }
  expect((await call<{total:number}>(`${base}/ledger`)).total).toBe(2)
  await page.goto('/app')
  await page.getByRole('link',{name:'Import a form',exact:true}).click()
  await page.getByLabel('Form definition JSON').setInputFiles({name:'team-group.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(questionGroupDefinition()))})
  await page.getByRole('button',{name:'Review import',exact:true}).click()
  const structure=page.getByRole('region',{name:'Imported form structure',exact:true})
  await expect(structure).toContainText('Your team')
  await expect(structure).toContainText('Your name')
  await expect(structure).toContainText('Team size')
  await expect(structure).toContainText('Ready to talk?')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/${info.project.name}-groups-import.png`,fullPage:true})
})
