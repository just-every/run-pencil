import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { nativeHost } from './brand-helpers'
import type { BuilderDraft, TrafficReport } from '../../src/core/app/api'

async function trainingForm(page:import('@playwright/test').Page,withOther=false) {
  await signInEmptyWorkspace(page)
  const origin=new URL(page.url()).origin
  const call=async<T,>(path:string,data?:unknown,method=data===undefined?'GET':'POST'):Promise<T>=>{
    const response=await page.request.fetch(path,{method,headers:{Origin:origin},...(data===undefined?{}:{data})})
    expect(response.ok(),path).toBe(true)
    return response.status()===204?undefined as T:await response.json()
  }
  const flow=await call<{id:string;slug:string}>('/api/app/flows',{title:'Workshop evaluation',slug:'workshop-'+crypto.randomUUID().slice(0,8)})
  const root=`/api/app/flows/${flow.id}`
  for(const step of [{kind:'question',questionType:'short_text',prompt:'What should we improve?',required:true},{kind:'completion',questionType:null,prompt:'Thank you for helping the next workshop.'}]) {
    const draft=await call<BuilderDraft>(root+'/draft')
    await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step})
  }
  if(withOther) {
    await page.goto(`/app/flows/${flow.id}/builder`)
    await page.getByLabel('Question type').selectOption('multiple_choice')
    await page.getByRole('button',{name:'Choice',exact:true}).click()
    await page.getByLabel('Choice 1 label').fill('Timing')
    await page.getByLabel('Allow Other write-in').check()
    await page.getByRole('button',{name:'Save',exact:true}).click()
    await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  }
  await call(root+'/publish',{expectedVersion:(await call<BuilderDraft>(root+'/draft')).flow.draftVersion})
  const published=await call<{revision:{id:string}}>(`/api/public/flows/${flow.slug}`)
  return {flow,root,call,origin,revisionId:published.revision.id}
}

contract('RSLT-013','an operator reviews and releases a retained bot exclusion without changing views or starts',async({page},info)=>{
  const f=await trainingForm(page,true)
  await page.goto(`/f/${f.flow.slug}`)
  await expect(page.locator('.respondent-shell[data-hydrated=true]')).toBeVisible()
  await page.getByRole('option',{name:'Other',exact:true}).click()
  await page.getByRole('textbox',{name:'Please specify: Other',exact:true}).fill('Please keep this feedback for a person to review.')
  await page.locator('input[name=company-website]').fill('automated.example',{force:true})
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Thank you for helping the next workshop.'})).toBeVisible()
  const before=await f.call<TrafficReport>(f.root+'/traffic?revisionId='+f.revisionId)
  expect(before.totals).toEqual({views:1,starts:1,submissions:0})
  await page.goto(`/app/flows/${f.flow.id}/results`)
  const review=page.getByRole('region',{name:'Quarantined responses'})
  await expect(review.getByText('Held for review: the hidden bot-check field was filled.',{exact:true})).toBeVisible()
  await expect(review.locator('dd')).toContainText('Please keep this feedback for a person to review.')
  await review.screenshot({path:`test-results/${info.project.name}-traffic-quarantine.png`})
  await review.getByRole('button',{name:'Release into results',exact:true}).click()
  await expect(review.getByText('No quarantined responses for this revision.',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Refresh traffic',exact:true}).click()
  const traffic=page.getByRole('region',{name:'Views to submissions'})
  await expect(traffic.getByText('1 submission / 1 start',{exact:true})).toBeVisible()
  await traffic.getByText('Traffic counting scope',{exact:true}).click()
  await traffic.screenshot({path:`test-results/${info.project.name}-traffic-release.png`})
  expect((await f.call<TrafficReport>(f.root+'/traffic?revisionId='+f.revisionId)).totals).toEqual({...before.totals,submissions:1})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

contract('RSLT-013','QR-labelled links and a business website popup keep independent source conversion counts',async({page,browser},info)=>{
  test.setTimeout(120_000)
  const f=await trainingForm(page)
  const qr=await f.call<{id:string;publicPath:string}>(f.root+'/collectors',{name:'Workshop poster QR',channel:'qr'})
  const popup=await f.call<{id:string;embedPath:string}>(f.root+'/collectors',{name:'Website popup',channel:'embed'})
  // The business owns this dialog; Pencil supplies its ordinary isolated embed.
  const host=await nativeHost(`<button onclick="document.querySelector('dialog').showModal();document.querySelector('iframe').src='${f.origin}${popup.embedPath}'">Share workshop feedback</button><dialog style="width:calc(100% - 32px);max-width:900px;padding:0"><iframe title="Workshop feedback" sandbox="allow-scripts allow-forms" referrerpolicy="origin" style="width:100%;height:900px;border:0"></iframe></dialog>`)
  const visitor=await browser.newContext({viewport:info.project.use.viewport,extraHTTPHeaders:{}})
  try {
    const workspace=await f.call<Record<string,unknown>>('/api/app/workspace')
    await f.call('/api/app/workspace',{...workspace,embedAllowedOrigins:[host.origin]},'PUT')
    const respondent=await visitor.newPage()
    await respondent.goto(f.origin+qr.publicPath)
    await respondent.getByRole('textbox',{name:'What should we improve?'}).fill('More hands-on examples from the poster.')
    await respondent.waitForTimeout(3200)
    await respondent.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(respondent.getByRole('heading',{name:'Thank you for helping the next workshop.'})).toBeVisible()
    await respondent.screenshot({path:`test-results/${info.project.name}-traffic-qr-complete.png`,fullPage:true})
    await respondent.goto(host.origin)
    await respondent.getByRole('button',{name:'Share workshop feedback'}).click()
    const frame=respondent.frameLocator('iframe')
    await frame.getByRole('textbox',{name:'What should we improve?'}).fill('A follow-up workshop requested from the website.')
    await respondent.waitForTimeout(3200)
    await frame.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(frame.getByRole('heading',{name:'Thank you for helping the next workshop.'})).toBeVisible()
    await respondent.screenshot({path:`test-results/${info.project.name}-traffic-popup-complete.png`,fullPage:true})
    expect(await respondent.locator('body').innerText()).not.toContain('A follow-up workshop')
    const report=await f.call<TrafficReport>(f.root+'/traffic?revisionId='+f.revisionId)
    for(const id of [qr.id,popup.id])expect(report.rows.find(row=>row.source==='collector:'+id)).toMatchObject({views:1,starts:1,submissions:1})
    await page.goto(`/app/flows/${f.flow.id}/results`)
    const traffic=page.getByRole('region',{name:'Views to submissions'})
    await traffic.getByLabel('Traffic source').selectOption('collector:'+popup.id)
    await expect(traffic.getByText('1 start / 1 view',{exact:true})).toBeVisible()
    await expect(traffic.getByText('1 submission / 1 start',{exact:true})).toBeVisible()
    await traffic.screenshot({path:`test-results/${info.project.name}-traffic-collector.png`})
  } finally {await visitor.close();await host.close()}
})
