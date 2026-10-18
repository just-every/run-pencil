import { expect, test } from './fixtures'
import { contract } from './contract'
import { signInEmptyWorkspace } from './authoring-helpers'
import { completionFixture } from '../fixtures/completion-redirects'

contract('LOGIC-005','authors an approved redirect, previews without leaving and collects both conditional completion targets',async({page},info)=>{
  test.setTimeout(120_000);page.setDefaultTimeout(15_000)
  await signInEmptyWorkspace(page)
  const call=async<T,>(path:string,data?:unknown,method?:string):Promise<T>=>{
    const response=await page.request.fetch(path,{method:method??(data===undefined?'GET':'POST'),...(data===undefined?{}:{data})})
    expect(response.status(),await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const slug=`sales-consultation-${info.project.name}-${Date.now()}`,f=await completionFixture(call,slug)
  await call(`${f.base}/draft/settings`,{expectedVersion:(await f.read()).flow.draftVersion,settings:{...f.settings,redirectOrigins:[]}},'PUT')
  await page.goto(`/app/flows/${f.id}/builder`)
  await page.getByRole('complementary',{name:'Flow steps'}).getByRole('button',{name:/Book your consultation/}).click()
  const settings=page.getByRole('complementary',{name:'Step settings'})
  await settings.getByText('Completion redirect',{exact:true}).click()
  await settings.getByLabel('Completion action',{exact:true}).selectOption('redirect')
  await settings.getByLabel('Redirect URL',{exact:true}).fill('https://sales.example.test/book?fixed=consultation')
  for(const [name,operand] of [['team',f.size.id],['campaign','hidden:plan'],['quote','variable:total']]) {
    await settings.getByRole('button',{name:'Add redirect parameter',exact:true}).click()
    const n=await settings.getByRole('group',{name:/Parameter \d/}).count()
    await settings.getByLabel(`Parameter name ${n}`,{exact:true}).fill(name)
    await settings.getByLabel(`Parameter value ${n}`,{exact:true}).selectOption(operand)
  }
  await page.screenshot({path:`test-results/${info.project.name}-completion-redirect-settings.png`,fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await settings.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('approved HTTPS origin')
  await page.getByText('Publication options',{exact:true}).click()
  await page.getByText('Approved redirect origins',{exact:true}).click()
  await page.getByLabel('Approved HTTPS origins').fill('https://sales.example.test')
  await page.getByRole('button',{name:'Save redirect origins',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  await page.getByText('Approved redirect origins',{exact:true}).click()
  await page.getByLabel('Approved HTTPS origins').scrollIntoViewIfNeeded()
  await page.screenshot({path:`test-results/${info.project.name}-completion-approved-origins.png`,fullPage:true})
  await page.getByRole('button',{name:'Preview draft',exact:true}).click()
  const preview=page.getByRole('region',{name:'Draft preview'})
  await preview.getByLabel('Preview plan').fill('enterprise')
  await preview.getByRole('radio',{name:/Very satisfied/}).click()
  await preview.getByRole('button',{name:'Continue preview',exact:true}).click()
  await preview.getByRole('spinbutton',{name:'Team size',exact:true}).fill('60')
  await preview.getByRole('button',{name:'Continue preview',exact:true}).click()
  await preview.getByRole('radio',{name:'Yes',exact:true}).check()
  await preview.getByRole('button',{name:'Continue preview',exact:true}).click()
  await expect(preview).toContainText('After a saved submission, redirect to: https://sales.example.test/book?fixed=consultation&team=60&campaign=enterprise&quote=120')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/${info.project.name}-completion-preview.png`,fullPage:true})
  expect((await call<{total:number}>(`${f.base}/ledger`)).total).toBe(0)
  await preview.getByRole('button',{name:'Close preview',exact:true}).click()
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  await expect(page.getByRole('region',{name:'Share this flow'})).toBeVisible()
  let destination:string|undefined
  await page.route('https://sales.example.test/**',async route=>{destination=route.request().url();await route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><title>Sales destination</title><h1>Schedule your consultation</h1></html>'})})
  for(const plan of ['basic','enterprise']) {
    await page.goto(`/f/${slug}?plan=${plan}&secret=not-declared`)
    await page.getByRole('radio',{name:/Very satisfied/}).click()
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('spinbutton',{name:'Team size',exact:true}).fill('60')
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('radio',{name:'Yes',exact:true}).check()
    await page.waitForTimeout(3200)
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    if(plan==='basic') {
      await expect(page.getByRole('heading',{name:'We will keep in touch',exact:true})).toBeVisible()
      expect(destination).toBeUndefined()
      await page.screenshot({path:`test-results/${info.project.name}-completion-screen.png`,fullPage:true})
    } else {
      await expect(page).toHaveURL('https://sales.example.test/book?fixed=consultation&team=60&campaign=enterprise&quote=120')
      expect(destination).not.toContain('secret')
    }
  }
  expect((await call<{total:number}>(`${f.base}/ledger`)).total).toBe(2)
})
