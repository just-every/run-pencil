import { appHeaders } from './api-headers'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { contract } from './contract'
import { expect, test, openMailLink } from './fixtures'
import { operatorEmail } from './auth-identity'
import AxeBuilder from '@axe-core/playwright'
import type { BuilderDraft, FlowResults } from '../../src/core/app/api'
contract(['RSLT-001','RSLT-003','LEDG-001','LEDG-003','BASE-PUBLIC-003'], 'full text counts and Previous retain every byte-bounded response page',async({page},info)=> {
  test.setTimeout(180000)
  const capture=async(name:string)=> { if(process.env.PENCIL_CAPTURE_DIR) { await mkdir(process.env.PENCIL_CAPTURE_DIR,{recursive:true});await page.screenshot({path:join(process.env.PENCIL_CAPTURE_DIR,`${info.project.name}-${name}.png`)}) } }
  await page.setViewportSize(info.project.name==='mobile'?{width:390,height:844}:{width:1440,height:900})
  await page.goto('/signin');await page.getByLabel('Operator email').fill(operatorEmail())
  await page.getByRole('button',{name:/Send.*link/i}).click();await openMailLink(page, operatorEmail());await page.getByRole('button',{name:'Confirm',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Your flows'})).toBeVisible()
  let serial=0
  const call=async<T,>(path:string,data?:unknown):Promise<T>=> {
    const response=await page.request.fetch(path,{method:data===undefined?'GET':'POST',headers:{...appHeaders,'CF-Connecting-IP':`198.18.177.${++serial % 250}`},...(data===undefined?{}:{data})})
    expect(response.status(),path).toBeLessThan(300)
    return response.status()===204 ? undefined as T : await response.json() as T
  }
  const slug=`text-count-${info.project.name}-${Date.now()}`
  const flow=await call<{id:string}>('/api/app/flows',{title:'Retained response pages',slug}),path=`/api/app/flows/${flow.id}`
  let draft=await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/draft/steps`,{expectedVersion:draft.flow.draftVersion,step:{kind:'question',questionType:'long_text',prompt:'Retained comment',required:false}})
  draft=await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/draft/steps`,{expectedVersion:draft.flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'Done'}})
  draft=await call<BuilderDraft>(`${path}/draft`);const publication=await call<{revision:{id:string}}>(`${path}/publish`,{expectedVersion:draft.flow.draftVersion})
  const view=()=>call(`/api/public/flows/${slug}/views`,{revisionId:publication.revision.id,source:'direct'})
  await view();await view()
  for(let index=0;index<71;index++) {
    await view()
    const session=await call<{sessionId:string;sessionToken:string}>(`/api/public/flows/${slug}/sessions`,{deviceClass:'desktop',source:'direct'})
    const receipt=await call<{responseId:string;disposition:string}>(`/api/public/flows/${slug}/responses`,{...session,idempotencyKey:`count-${session.sessionId}-${index}`,answers:[{stepId:draft.steps[0].id,value:`É%_'" answer ${String(index).padStart(3,'0')} `.padEnd(700,'z')}]})
    if(receipt.disposition==='quarantined') await call(`/api/app/responses/${receipt.responseId}/release`,{})
  }
  await page.goto(`/app/flows/${flow.id}/results`)
  const summary=page.locator('.results-summary')
  const metric=(label:string)=>summary.locator('article').filter({has:page.getByText(label,{exact:true})})
  await expect(metric('Responses').locator('strong')).toHaveText('71')
  await expect(metric('Starts').locator('strong')).toHaveText('71')
  await expect(metric('Completion rate')).toContainText('71 native completions / 73 views')
  await expect(metric('Completion rate').locator('strong')).toHaveText('97%')
  await expect(page.getByText('Your choice applies only to your account and this flow.')).toBeVisible()
  await expect(page.getByText(/Daily digest is not available/)).toHaveCount(0)
  const answers=page.getByRole('region',{name:'Answers',exact:true})
  await expect(answers.getByText('71 matching answers · latest first · 5 on this page')).toBeVisible()
  await capture('full-text-count')
  await answers.getByRole('searchbox').fill('é%_');await expect(answers.getByText('71 matching answers · latest first · 5 on this page')).toBeVisible()
  await answers.getByRole('searchbox').fill('answer 000');await expect(answers.getByText('1 matching answer · latest first · 1 on this page')).toBeVisible()
  await expect(answers.getByText(/^É%_'" answer 000/)).toBeVisible()
  await answers.getByRole('searchbox').fill('');await answers.getByRole('button',{name:'Show more answers'}).click()
  await expect(answers.getByText('71 matching answers · latest first · 10 on this page')).toBeVisible()
  const ledger=page.getByRole('region',{name:'Response ledger'})
  await ledger.getByLabel('Source',{exact:true}).selectOption('direct')
  await ledger.getByLabel('Device class',{exact:true}).selectOption('desktop')
  await ledger.getByRole('searchbox',{name:'Search responses',exact:true}).fill('answer 000')
  await ledger.getByRole('button',{name:'Search',exact:true}).click()
  const filtered=await call<FlowResults>(`${path}/results?${new URLSearchParams({revisionId:publication.revision.id,source:'direct',deviceClass:'desktop',search:'answer 000'})}`)
  expect(filtered).toMatchObject({completedResponses:1,starts:1,rateBasis:'responses',rateNumerator:1,rateDenominator:1,views:73,durationSamples:1})
  await expect(metric('Responses').locator('strong')).toHaveText('1')
  await expect(metric('Starts').locator('strong')).toHaveText('1')
  await expect(metric('Completion rate')).toContainText('1 native completions / 1 filtered native response starts')
  await expect(metric('Average time')).toContainText(`${filtered.totalCompletionMilliseconds}ms total / 1 native completed responses`)
  await expect(answers.getByText('1 matching answer · latest first · 1 on this page')).toBeVisible()
  await expect(ledger.locator('.ledger-row')).toHaveCount(1)
  await expect(page.getByText(/View-based rates are unfiltered by response filters; 73 views/)).toBeVisible()
  await ledger.getByRole('button',{name:'Clear response filters',exact:true}).click()
  await expect(metric('Completion rate')).toContainText('71 native completions / 73 views')
  await expect(metric('Starts').locator('strong')).toHaveText('71')
  await expect(answers.getByText('71 matching answers · latest first · 5 on this page')).toBeVisible()
  await expect(ledger.getByText('1–25 / 71',{exact:true})).toBeVisible()
  await ledger.getByRole('button',{name:'Next responses'}).click();await expect(ledger.getByText('26–50 / 71',{exact:true})).toBeVisible()
  await ledger.getByRole('button',{name:'Next responses'}).click();await expect(ledger.getByText('51–71 / 71',{exact:true})).toBeVisible()
  await ledger.getByRole('button',{name:'Previous responses'}).click();await expect(ledger.getByText('26–50 / 71',{exact:true})).toBeVisible()
  const firstPage=page.waitForResponse(response=>{
    const url=new URL(response.url())
    return url.pathname===`${path}/ledger` && url.searchParams.get('offset')==='0'
  })
  await ledger.getByRole('button',{name:'Previous responses'}).click();await firstPage
  await expect(ledger.getByText('1–25 / 71',{exact:true})).toBeVisible()
  await expect(ledger.getByRole('button',{name:'Previous responses'})).toBeDisabled()
  await ledger.getByRole('button',{name:'Previous responses'}).scrollIntoViewIfNeeded();await capture('ledger-history')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect((await new AxeBuilder({page}).include('.operator-content').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([])
})
