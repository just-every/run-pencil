import AxeBuilder from '@axe-core/playwright'
import {contract} from './contract'
import {expect,openMailLink,test} from './fixtures'
import {operatorEmail} from './auth-identity'
import {appHeaders} from './api-headers'
import {answer,startAiReceiver} from './ai-receiver'
import {downloadedText} from './export-helpers'
import type {BuilderDraft} from '../../src/core/app/api'

contract('RSLT-012','operators code retained text, accept and reject exact suggestions, compare and export the coded cohort',async({page},info)=>{
  test.setTimeout(120_000)
  const provider=await startAiReceiver()
  const practiceName='Hands-on practice '+info.project.name,staffingName='Staffing '+info.project.name
  let serial=0
  const call=async<T,>(path:string,data?:unknown,method=data===undefined?'GET':'POST'):Promise<T>=>{
    const response=await page.request.fetch(path,{method,headers:{...appHeaders,'CF-Connecting-IP':`198.18.212.${++serial%250}`},...(data===undefined?{}:{data})})
    expect(response.ok(),await response.text()).toBe(true)
    return response.status()===204?undefined as T:await response.json()
  }
  try {
    const email=operatorEmail()
    await page.goto('/signin');await page.getByLabel('Operator email').fill(email);await page.getByRole('button',{name:/Send.*link/i}).click()
    await openMailLink(page,email);await page.getByRole('button',{name:'Confirm',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Your flows'})).toBeVisible()
    await call('/api/app/connections/analysis',{provider:'compatible',baseUrl:`http://127.0.0.1:${Number(process.env.PENCIL_E2E_PORT??4173)+3}/v1`,model:'synthetic-coding-model',apiKey:'synthetic-browser-ai-key'},'PUT')
    const slug='coding-'+info.project.name+'-'+Date.now(),flow=await call<{id:string}>('/api/app/flows',{title:'Workshop follow-up',slug})
    const root=`/api/app/flows/${flow.id}`,draft=()=>call<BuilderDraft>(root+'/draft')
    for(const step of [{kind:'question',questionType:'long_text',prompt:'What would improve the workshop?',required:true},{kind:'completion',questionType:null,prompt:'Thanks for your feedback'}])await call(root+'/draft/steps',{expectedVersion:(await draft()).flow.draftVersion,step})
    await call(root+'/publish',{expectedVersion:(await draft()).flow.draftVersion})
    const question=(await draft()).steps[0].id,published=await call<{revision:{id:string}}>('/api/public/flows/'+slug)
    const texts=['More time for the hands-on exercises.','A second facilitator would help with the exercises.','The exercises need clearer instructions.','Include more advanced exercises.','Smaller groups for exercises.','Share the exercise notes afterward.'],ids:string[]=[]
    await page.goto('/f/'+slug)
    await page.getByRole('textbox',{name:'What would improve the workshop?'}).fill(texts[0]);await page.waitForTimeout(3200)
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Thanks for your feedback'})).toBeVisible()
    ids.push((await call<{responses:Array<{id:string}>}>(root+'/ledger')).responses[0].id)
    for(const [index,text] of texts.slice(1).entries()) {
      const session=await call<Record<string,string>>('/api/public/flows/'+slug+'/sessions',{source:'direct',deviceClass:'mobile'})
      const receipt=await call<{responseId:string;disposition:string}>('/api/public/flows/'+slug+'/responses',{...session,idempotencyKey:slug+index,answers:[{stepId:question,value:text}]})
      if(receipt.disposition==='quarantined')await call('/api/app/responses/'+receipt.responseId+'/release',{})
      ids.push(receipt.responseId)
    }
    provider.script.push(answer({outcome:'findings',reason:'',themes:[{title:'Hands-on practice',summary:'Visitors want more support for exercises.',responseIds:ids,count:6,quotes:[{responseId:ids[1],questionId:question,start:0,end:texts[1].length,text:texts[1]},{responseId:ids[2],questionId:question,start:0,end:texts[2].length,text:texts[2]}]}],recommendations:[]}))
    expect(await call<{state:string}>('/api/app/analysis',{flowId:flow.id,revisionId:published.revision.id,questionIds:[question]})).toMatchObject({state:'completed'})
    await page.goto(`/app/flows/${flow.id}/results`)
    const panel=page.getByRole('region',{name:'Organise feedback with codes'})
    await expect(panel.getByText('6 released responses · 6 nonempty text answers and Other write-ins',{exact:true})).toBeVisible()
    await panel.screenshot({path:`test-results/${info.project.name}-coding-empty.png`})
    for(const name of [practiceName,staffingName]) {await panel.getByLabel('New code',{exact:true}).fill(name);await panel.getByRole('button',{name:'Create code',exact:true}).click();await expect(panel.getByLabel('New code',{exact:true})).toHaveValue('')}
    const codes=(await call<{codes:Array<{id:string;label:string}>}>('/api/app/codes')).codes,practice=codes.find(code=>code.label===practiceName)!,staffing=codes.find(code=>code.label===staffingName)!
    const first=panel.locator('.coding-answer').filter({hasText:texts[0]})
    await first.getByLabel('Code for this answer').selectOption(practice.id);await first.getByRole('button',{name:'Assign code',exact:true}).click()
    await expect(first.getByRole('button',{name:`Remove ${practiceName} from this answer`})).toBeVisible()
    await first.getByLabel('Code for this answer').selectOption(staffing.id);await first.getByRole('button',{name:'Assign code',exact:true}).click()
    const accepted=panel.locator('.coding-suggestion').filter({hasText:texts[1]})
    await accepted.getByLabel('Accept as code').selectOption(practice.id);await accepted.getByRole('button',{name:'Accept',exact:true}).click();await expect(accepted.getByText(/Accepted · operator/)).toBeVisible()
    const rejected=panel.locator('.coding-suggestion').filter({hasText:texts[2]})
    await rejected.getByRole('button',{name:'Reject',exact:true}).click();await expect(rejected.getByText(/Rejected · operator/)).toBeVisible()
    const distribution=panel.getByRole('region',{name:'Code distribution'})
    await expect(distribution.getByText('2 / 6 answers',{exact:true})).toBeVisible()
    await panel.getByLabel('Row code',{exact:true}).selectOption(practice.id);await panel.getByLabel('Column code',{exact:true}).selectOption(staffing.id)
    await expect(panel.getByRole('table')).toContainText(`${practiceName} × ${staffingName}`)
    expect(await panel.getByRole('cell').allTextContents()).toEqual(['1','1','0','4'])
    expect((await new AxeBuilder({page}).include('.coding-panel').analyze()).violations).toEqual([])
    await panel.screenshot({path:`test-results/${info.project.name}-coding-assigned.png`})
    await panel.getByLabel('Code filter for answers, ledger and exports').selectOption(practice.id)
    const ledger=page.getByRole('region',{name:'Response ledger'})
    await expect(ledger.getByRole('button',{name:'View answers',exact:true})).toHaveCount(2)
    const pending=page.waitForEvent('download');await ledger.getByRole('button',{name:'Export JSON',exact:true}).click()
    const exported=JSON.parse(await downloadedText(await pending))
    expect(exported.responses.map((row:{id:string})=>row.id).sort()).toEqual(ids.slice(0,2).sort())
    expect(exported.filter.codeId).toBe(practice.id)
    await expect(distribution.getByText('2 / 2 answers',{exact:true})).toBeVisible()
    await panel.screenshot({path:`test-results/${info.project.name}-coding-filtered.png`})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await first.getByRole('button',{name:`Remove ${staffingName} from this answer`}).click()
    await expect(first.getByRole('button',{name:`Remove ${staffingName} from this answer`})).toHaveCount(0)
    await page.reload();await expect(panel.locator('.coding-suggestion').filter({hasText:texts[1]}).getByText(/Accepted · operator/)).toBeVisible()
    await page.goto('/docs/results')
    const help=page.getByRole('heading',{name:'Organise open text with codes',exact:true})
    await help.scrollIntoViewIfNeeded();await expect(help).toBeVisible()
    await page.screenshot({path:`test-results/${info.project.name}-coding-help.png`})
  } finally {try {await page.request.delete('/api/app/connections/analysis',{headers:appHeaders,data:{},timeout:5000})} finally {await provider.close()}}
})
