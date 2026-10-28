import { mkdir } from 'node:fs/promises'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { csvRows, downloadedText } from './export-helpers'
import type { BuilderDraft } from '../../src/core/app/api'

contract(["FIELD-010","FIELD-017"], "Other write-ins survive native collection, results export and explicit import column review", async ({ page }, info) => {
  await test.step("a buyer builds Other and None, collects write-ins and reads their counts and CSV at both widths", async () => {
    const origin=new URL(info.project.use.baseURL!).origin
    await signInEmptyWorkspace(page)
    const call=async <T,>(path:string,data?:unknown,method='POST')=>{const r=await page.request.fetch(path,{method:data===undefined?'GET':method,headers:{Origin:origin},...(data===undefined?{}:{data})});expect(r.status(),await r.text()).toBeLessThan(300);return await r.json() as T}
    const slug=`service-feedback-${info.project.name}-${Date.now()}`
    const flow=await call<{id:string}>('/api/app/flows',{title:'Service feedback',slug})
    const path=`/api/app/flows/${flow.id}`
    await call(`${path}/draft/steps`,{expectedVersion:0,step:{kind:'question',questionType:'multiple_choice',prompt:'Which services would help?',required:true,choices:[{value:'appointments',label:'Appointments'},{value:'delivery',label:'Delivery'}]}})
    let d=await call<BuilderDraft>(`${path}/draft`)
    await call(`${path}/draft/steps`,{expectedVersion:d.flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'Thanks for shaping our service'}})
    await page.goto(`/app/flows/${flow.id}/builder`)
    await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    await page.getByLabel('Allow Other write-in').check()
    await page.getByLabel('Allow None of the above').check()
    await page.getByRole('button',{name:'Save',exact:true}).click()
    await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
    const shots=process.env.PENCIL_PROOF_DIR
    if(shots){await mkdir(shots,{recursive:true});await page.screenshot({path:`${shots}/other-builder-${info.project.name}.png`,fullPage:true})}
    d=await call<BuilderDraft>(`${path}/draft`)
    await call(`${path}/publish`,{expectedVersion:d.flow.draftVersion})
    await page.goto(`/f/${slug}`)
    await page.getByRole('option',{name:'Other',exact:true}).click()
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(page.getByRole('alert')).toContainText('Please specify')
    await page.getByRole('textbox',{name:'Please specify: Other',exact:true}).fill('Evening appointments')
    await page.getByRole('option',{name:'Appointments',exact:true}).click()
    await page.getByRole('option',{name:'None of the above',exact:true}).click()
    await expect(page.getByRole('textbox',{name:'Please specify: Other'})).toHaveCount(0)
    await expect(page.getByRole('option',{name:'Appointments',exact:true})).toHaveAttribute('aria-selected','false')
    await page.getByRole('option',{name:'Other',exact:true}).click()
    await expect(page.getByRole('option',{name:'None of the above',exact:true})).toHaveAttribute('aria-selected','false')
    await expect(page.getByRole('textbox',{name:'Please specify: Other'})).toHaveValue('')
    await page.getByRole('textbox',{name:'Please specify: Other'}).fill('Evening appointments')
    if(shots) await page.screenshot({path:`${shots}/other-answer-${info.project.name}.png`,fullPage:true})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.waitForTimeout(3200)
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Thanks for shaping our service'})).toBeVisible()
    if(shots) await page.screenshot({path:`${shots}/other-completed-${info.project.name}.png`,fullPage:true})
    await page.goto(`/app/flows/${flow.id}/results`)
    await expect(page.getByText('Evening appointments',{exact:false}).first()).toBeVisible()
    if(shots) await page.screenshot({path:`${shots}/other-results-${info.project.name}.png`,fullPage:true})
    const ledger=page.getByRole('region',{name:'Response ledger'})
    const downloaded=page.waitForEvent('download');
    await ledger.getByRole('button',{name:'Export CSV'}).click()
    const csv=csvRows(await downloadedText(await downloaded))
    const col=csv[0].indexOf(`${d.steps[0].id}.other_text`)
    expect(col).toBeGreaterThan(-1);
    expect(csv[1][col]).toBe('Evening appointments')
  });
  await test.step("a buyer reviews an explicit Other write-in column without losing its text", async () => {
    await page.context().clearCookies();
    await signInEmptyWorkspace(page)
    await page.getByRole('link',{name:'Import a form'}).click()
    const definition=JSON.stringify({title:'Service feedback from Typeform',fields:[{id:'service',type:'multiple_choice',title:'Service',properties:{choices:[{label:'Delivery'}],allow_other_choice:true},validations:{required:false}}]})
    await page.getByLabel('Form definition JSON').setInputFiles({name:'service.json',mimeType:'application/json',buffer:Buffer.from(definition)})
    await page.getByLabel('Response CSV (optional)').setInputFiles({name:'responses.csv',mimeType:'text/csv',buffer:Buffer.from('Submit Date (UTC),Service,Other\n2026-10-10T12:00:00Z,,Evening appointments')})
    await page.getByRole('button',{name:'Review import',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Review the mapping'})).toBeVisible()
    await expect(page.getByText(/1 valid response rows/)).toBeVisible()
    await expect(page.getByLabel('3. Other')).toHaveValue(/::/)
    const shots=process.env.PENCIL_PROOF_DIR
    if(shots){await mkdir(shots,{recursive:true});await page.screenshot({path:`${shots}/other-import-${info.project.name}.png`,fullPage:true})}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  });
})
