import type { BuilderDraft, Ledger } from '../../src/core/app/api'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

contract('FIELD-001','builds hidden link fields, previews their rules, collects declared values and exports them',async({page},info)=>{
  test.setTimeout(120_000);page.setDefaultTimeout(15_000)
  await signInEmptyWorkspace(page)
  const slug=`campaign-consultation-${info.project.name}-${Date.now()}`
  const call=async<T,>(path:string,method='GET',data?:unknown)=>{
    const response=await page.request.fetch(path,{method,...(data===undefined?{}:{data})})
    expect(response.status(),await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const flow=await call<{id:string}>('/api/app/flows','POST',{title:'Campaign consultation',slug})
  const base=`/api/app/flows/${flow.id}`,read=()=>call<BuilderDraft>(`${base}/draft`)
  for(const step of [
    {kind:'question',questionType:'number',prompt:'How many people are on your team?',required:true},
    {kind:'completion',questionType:null,prompt:'Standard consultation'},
    {kind:'completion',questionType:null,prompt:'Enterprise consultation'},
    {kind:'completion',questionType:null,prompt:'Choose your plan'},
  ])await call(`${base}/draft/steps`,'POST',{expectedVersion:(await read()).flow.draftVersion,step})
  await page.goto(`/app/flows/${flow.id}/builder`)
  await page.getByText('Hidden fields and identity',{exact:true}).click()
  await page.getByRole('button',{name:'Add hidden field',exact:true}).click()
  await page.getByLabel('Parameter name 1',{exact:true}).fill('plan')
  await page.getByRole('button',{name:'Add hidden field',exact:true}).click()
  await page.getByLabel('Parameter name 2',{exact:true}).fill('utm_campaign')
  await page.getByLabel('Purpose 2',{exact:true}).selectOption('campaign')
  await expect(page.getByRole('button',{name:'Publish',exact:true})).toBeDisabled()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/${info.project.name}-hidden-builder.png`,fullPage:true})
  await page.getByRole('button',{name:'Save hidden fields',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  const draft=await read(),plan=draft.formSettings!.hiddenFields.find(field=>field.name==='plan')!,[question,,enterprise,blank]=draft.steps
  const settings=page.getByRole('complementary',{name:'Step settings'})
  await settings.getByRole('button',{name:'Add condition rule',exact:true}).click()
  const rule=settings.getByRole('group',{name:'Rule 1',exact:true})
  await rule.getByLabel('Question',{exact:true}).selectOption(`hidden:${plan.id}`)
  await rule.getByLabel('Value',{exact:true}).fill('enterprise')
  await rule.getByLabel('Then go to',{exact:true}).selectOption(enterprise.id)
  await settings.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  // A second rule exercises the blank link value without turning it into an answer.
  const withRecall=await read(),campaign=withRecall.formSettings!.hiddenFields.find(field=>field.name==='utm_campaign')!
  await call(`${base}/draft`,'PUT',{expectedVersion:withRecall.flow.draftVersion,stepId:blank.id,prompt:`Choose your plan · {{hidden:${campaign.id}}}`,required:false})
  const next=await read()
  await call(`${base}/draft/branches`,'PUT',{expectedVersion:next.flow.draftVersion,rules:[...next.branchRules,{sourceStepId:question.id,predicateKind:'equals',expectedValue:null,destinationStepId:blank.id,position:1,condition:{kind:'test',stepId:`hidden:${plan.id}`,operator:'is_blank'}}]})
  await page.reload()
  await page.getByRole('button',{name:'Preview draft',exact:true}).click()
  const preview=page.getByRole('region',{name:'Draft preview'})
  await preview.getByLabel('Preview plan',{exact:true}).fill('enterprise')
  await preview.getByRole('spinbutton').fill('75')
  await preview.getByRole('button',{name:'Inspect answer path',exact:true}).click()
  await expect(preview.getByRole('region',{name:'Preview rule evaluations'})).toContainText('enterprise')
  await page.screenshot({path:`test-results/${info.project.name}-hidden-preview.png`,fullPage:true})
  await preview.getByRole('button',{name:'Close preview',exact:true}).click()
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  await expect(page.getByRole('region',{name:'Share this flow'})).toBeVisible()
  for(const [query,end] of [['?plan=enterprise&utm_campaign=spring&secret=never-retain','Enterprise consultation'],['?utm_campaign=summer','Choose your plan · summer']] as const){
    await page.goto(`/f/${slug}${query}`)
    await expect(page.getByRole('heading',{name:question.prompt,exact:true})).toBeVisible()
    await page.getByRole('spinbutton').fill('75')
    await page.waitForTimeout(3200)
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(page.getByRole('heading',{name:end,exact:true})).toBeVisible()
    await page.screenshot({path:`test-results/${info.project.name}-hidden-${end.startsWith('Enterprise')?'enterprise':'blank'}.png`,fullPage:true})
  }
  await page.goto(`/app/flows/${flow.id}/results`)
  await page.getByRole('button',{name:'View answers',exact:true}).first().click()
  await expect(page.getByText('Hidden fields · link-supplied, unverified',{exact:true})).toBeVisible()
  await page.getByRole('region',{name:'Response ledger',exact:true}).screenshot({path:`test-results/${info.project.name}-hidden-ledger.png`})
  const ledger=await call<Ledger>(`${base}/ledger?search=spring`)
  expect(ledger.total).toBe(1)
  expect(ledger.responses[0].hiddenFields.some(field=>field.name==='utm_campaign'&&field.value==='spring')).toBe(true)
  const start=await call<{token:string}>(`${base}/responses/export/start?format=csv&search=spring`)
  const exported=await page.request.get(`${base}/responses/export?token=${encodeURIComponent(start.token)}`)
  const csv=await exported.text()
  expect(csv).toContain('hidden_fields_json')
  expect(csv).toContain('spring')
  expect(csv).not.toContain('never-retain')
  // Identified link disclosure and opt-out are part of the same public door.
  const latest=await read()
  await call(`${base}/draft/settings`,'PUT',{expectedVersion:latest.flow.draftVersion,settings:{...latest.formSettings,identityMode:'identified',hiddenFields:[...latest.formSettings!.hiddenFields,{id:'email',name:'email',type:'email',category:'identifying'}]}})
  await call(`${base}/publish`,'POST',{expectedVersion:(await read()).flow.draftVersion})
  await page.goto(`/f/${slug}?email=jo@example.com&plan=enterprise`)
  await expect(page.getByText(/Answering as jo@example.com/)).toBeVisible()
  await page.screenshot({path:`test-results/${info.project.name}-hidden-identity.png`,fullPage:true})
  await page.getByRole('button',{name:'This isn’t me',exact:true}).click()
  await expect(page.getByText(/Answering as jo@example.com/)).toHaveCount(0)
  await page.getByRole('spinbutton').fill('2')
  await page.waitForTimeout(3200)
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Enterprise consultation',exact:true})).toBeVisible()
  const identity=await call<Ledger>(`${base}/ledger`)
  expect(identity.responses[0].hiddenFields.some(field=>field.name==='email')).toBe(false)
})
