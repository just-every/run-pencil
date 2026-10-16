import { appHeaders } from './api-headers'
import { contract } from './contract'
import { expect, test, openMailLink } from './fixtures'
import { operatorEmail } from './auth-identity'
import { downloadedText, csvRows } from './export-helpers'
import AxeBuilder from '@axe-core/playwright'
import type { BuilderDraft } from '../../src/core/app/api'
contract(['RSLT-005','LEDG-001','LEDG-004','BASE-PUBLIC-003','BASE-OPS-004'], 'revision pages and streamed downloads retain every cohort with visible cancellation and failures',async({page,context},info)=> {
  test.setTimeout(180000)
  await page.setViewportSize(info.project.name==='mobile'?{width:390,height:844}:{width:1440,height:900})
  await page.goto('/signin');await page.getByLabel('Operator email').fill(operatorEmail())
  await page.getByRole('button',{name:/Send.*link/i}).click()
  await openMailLink(page, operatorEmail());await page.getByRole('button',{name:'Confirm',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Your flows'})).toBeVisible()
  let serial=0
  const call=async<T,>(path:string,data?:unknown):Promise<T>=> {
    const response=await page.request.fetch(path,{method:data===undefined?'GET':'POST',headers:{...appHeaders,'CF-Connecting-IP':`198.18.173.${++serial % 250}`},...(data===undefined?{}:{data})})
    expect(response.status(),path).toBeLessThan(300)
    return response.status()===204 ? undefined as T : await response.json() as T
  }
  const slug=`bounded-${info.project.name}-${Date.now()}`
  const flow=await call<{id:string}>('/api/app/flows',{title:'Bounded revision study',slug})
  const path=`/api/app/flows/${flow.id}`,draft=()=>call<BuilderDraft>(`${path}/draft`)
  let current=await draft()
  await call(`${path}/draft/steps`,{expectedVersion:current.flow.draftVersion,step:{kind:'question',questionType:'single_choice',prompt:'Published choices',required:false,choices:Array.from({length:100},(_,i)=>({value:String(i),label:`Choice ${i} `+'é"\\'.repeat(95)}))}})
  current=await draft();await call(`${path}/draft/steps`,{expectedVersion:current.flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'Complete'}})
  for(let index=0;index<3;index++) {
    current=await draft();await call(`${path}/publish`,{expectedVersion:current.flow.draftVersion})
    const session=await call<{sessionId:string;sessionToken:string}>(`/api/public/flows/${slug}/sessions`,{deviceClass:'desktop',source:'direct'})
    const receipt=await call<{responseId:string;disposition:string}>(`/api/public/flows/${slug}/responses`,{...session,idempotencyKey:`bounded-${session.sessionId}-${index}`,answers:[{stepId:current.steps[0].id,value:current.choices[0].id}]})
    if(receipt.disposition==='quarantined') await call(`/api/app/responses/${receipt.responseId}/release`,{})
  }
  await page.goto(`/app/flows/${flow.id}/results`)
  await page.getByRole('button',{name:'Compare revisions',exact:true}).click()
  const comparison=page.locator('#revision-comparison')
  const revisions:string[]=[]
  for(;;) {
    await expect(comparison.getByRole('heading',{level:4})).toHaveCount(1)
    revisions.push(await comparison.getByRole('heading',{level:4}).innerText())
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    const next=comparison.getByRole('button',{name:'Next revisions'})
    expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    if(await next.isDisabled()) break
    const old=await comparison.getByRole('heading',{level:4}).innerText()
    await next.click();await expect(comparison.getByRole('heading',{level:4})).not.toHaveText(old)
  }
  expect(revisions).toEqual(['Revision 3 · current','Revision 2','Revision 1'])
  await comparison.getByRole('button',{name:'Previous revisions'}).click()
  await expect(comparison.getByRole('heading',{level:4})).toHaveText('Revision 2')
  expect((await new AxeBuilder({page}).include('.operator-content').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([])
  await comparison.getByRole('button',{name:'Back to results'}).click()
  const ledger=page.getByRole('region',{name:'Response ledger'})
  await ledger.getByLabel('Response revision').selectOption('')
  await expect(ledger.getByText('3 matching completed responses',{exact:false})).toBeVisible()
  const jsonDownload=page.waitForEvent('download');await ledger.getByRole('button',{name:'Export JSON'}).click()
  const jsonFile=await jsonDownload,json=JSON.parse(await downloadedText(jsonFile))
  expect(await jsonFile.failure()).toBeNull();expect(json.responses).toHaveLength(3)
  expect(new Set(json.responses.map((row:{revisionId:string})=>row.revisionId)).size).toBe(3)
  await expect(ledger.getByRole('status')).toContainText('3 released responses exported')
  const csvDownload=page.waitForEvent('download');await ledger.getByRole('button',{name:'Export CSV'}).click()
  const csvFile=await csvDownload,rows=csvRows(await downloadedText(csvFile)).filter(row=>row.some(Boolean))
  expect(await csvFile.failure()).toBeNull();expect(rows).toHaveLength(4);expect(rows[0]).toContain('omitted_questions_json')
  expect(JSON.parse(rows[1][8])[0].displayValue).toBe(current.choices[0].label)
  await expect(ledger.getByRole('button',{name:'Export JSON'})).toBeEnabled()
  await context.route('**/responses/export',route=>route.continue({postData:JSON.stringify({token:'malformed'})}))
  const failedDownload=page.waitForEvent('download');await ledger.getByRole('button',{name:'Export JSON'}).click()
  expect(await (await failedDownload).failure()).not.toBeNull()
  await expect(ledger.getByRole('alert')).toContainText('Export failed')
  await context.unroute('**/responses/export')
  let release!:()=>void
  const held=new Promise<void>(resolve=>{release=resolve})
  let requests=0
  await context.route('**/responses/export',async route=>{requests++;await held;await route.continue().catch(()=>{})})
  const cancelDownload=page.waitForEvent('download');await ledger.getByRole('button',{name:'Export JSON'}).click()
  const cancelled=await cancelDownload;await cancelled.cancel();release()
  expect(await cancelled.failure()).not.toBeNull()
  await expect(ledger.getByRole('alert')).toContainText(/cancelled|Export failed/)
  expect(requests).toBeLessThanOrEqual(1)
  await context.unroute('**/responses/export')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect((await new AxeBuilder({page}).include('.operator-content').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([])
})
