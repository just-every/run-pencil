import type { Page, TestInfo } from '@playwright/test'
import { expect } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import type { BuilderDraft, Ledger, PublicFlow } from '../../src/core/app/api'

export async function proveRevisionIdentityLink(page:Page,info:TestInfo,flowId:string,slug:string) {
  const base=`/api/app/flows/${flowId}`
  const read=async()=>await (await page.request.get(`${base}/draft`)).json() as BuilderDraft
  const ledger=async()=>await (await page.request.get(`${base}/ledger`)).json() as Ledger
  const email=['synthetic-pencil-1','example.test'].join(String.fromCharCode(64))
  const replacementEmail=['synthetic-pencil-2','example.test'].join(String.fromCharCode(64))
  await page.goto(`/app/flows/${flowId}/builder`)
  await page.getByRole('button',{name:'Share',exact:true}).click()
  await page.getByRole('button',{name:'Prepare identifying link',exact:true}).click()
  await page.getByRole('textbox',{name:'Identifying email',exact:true}).fill(email)
  await page.getByRole('button',{name:'Create identifying link',exact:true}).click()
  const issued=page.getByRole('textbox',{name:'Identifying link',exact:true})
  await expect(issued).toBeVisible()
  const link=await issued.inputValue()
  expect(new URL(link).searchParams.get('identity')).toBeTruthy()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByRole('region',{name:'Share this flow',exact:true}).screenshot({path:`test-results/${info.project.name}-revision-identity-share.png`,mask:[issued]})
  const before=(await ledger()).total
  await page.goto(link)
  await expect(page.getByText(`Answering as ${email}.`,{exact:false})).toBeVisible()
  await expect(page.getByText('These link-supplied values are unverified.',{exact:false})).toBeVisible()
  await page.getByRole('spinbutton').fill('12')
  await page.waitForTimeout(3200)
  let captured:Record<string,unknown>|undefined
  await page.route(`**/api/public/flows/${slug}/responses`,async route=>{
    captured=route.request().postDataJSON() as Record<string,unknown>
    await route.continue()
  })
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Choose your plan',exact:false})).toBeVisible()
  await page.unroute(`**/api/public/flows/${slug}/responses`)
  const genuine=await ledger()
  expect(genuine.total).toBe(before+1)
  expect(genuine.responses[0]).toMatchObject({identityMode:'identified',hiddenFields:expect.arrayContaining([expect.objectContaining({name:'email',value:email})])})
  const replay=await page.request.post(`/api/public/flows/${slug}/responses`,{data:captured})
  expect(replay.status()).toBe(201)
  expect(await replay.json()).toMatchObject({responseId:genuine.responses[0].id,idempotent:true})
  expect((await ledger()).total).toBe(before+1)
  // Alter the actual browser transport; refusal must leave no response before a genuine retry.
  await page.goto(link)
  await page.getByRole('spinbutton').fill('13')
  await page.waitForTimeout(3200)
  await page.route(`**/api/public/flows/${slug}/responses`,async route=>{
    const input=route.request().postDataJSON()
    await route.continue({postData:JSON.stringify({...input,hidden:{...input.hidden,email:replacementEmail}})})
  })
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Identifying values cannot change')
  expect((await ledger()).total).toBe(before+1)
  await page.screenshot({path:`test-results/${info.project.name}-revision-identity-tampering.png`,fullPage:true})
  await page.unroute(`**/api/public/flows/${slug}/responses`)
  // A fresh tab removes the supplied identity; changing it instead is refused.
  await page.goto(link)
  await page.getByRole('button',{name:'This isn’t me',exact:true}).click()
  await expect(page.getByText(`Answering as ${email}.`,{exact:false})).toHaveCount(0)
  await page.getByRole('spinbutton').fill('14')
  await page.waitForTimeout(3200)
  let attemptedReplacement=false
  await page.route(`**/api/public/flows/${slug}/responses`,async route=>{
    const input=route.request().postDataJSON()
    expect(input.removeIdentity).toBe(true)
    expect(input.hidden.email).toBeUndefined()
    if(!attemptedReplacement){attemptedReplacement=true;await route.continue({postData:JSON.stringify({...input,hidden:{...input.hidden,email:replacementEmail}})})}
    else await route.continue()
  })
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('without replacement')
  expect((await ledger()).total).toBe(before+1)
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Choose your plan',exact:false})).toBeVisible()
  await page.unroute(`**/api/public/flows/${slug}/responses`)
  const removed=await ledger()
  expect(removed.total).toBe(before+2)
  expect(removed.responses[0].hiddenFields.some(field=>field.name==='email')).toBe(false)
  // An already admitted A session cannot write after B, and loading A explains the refusal.
  await page.goto(link)
  const admission=page.waitForResponse(response=>response.url().endsWith(`/api/public/flows/${slug}/sessions`)&&response.request().method()==='POST')
  await page.getByRole('spinbutton').fill('15')
  expect((await admission).status()).toBe(201)
  const latest=await read()
  const published=await page.request.post(`${base}/publish`,{data:{expectedVersion:latest.flow.draftVersion}})
  expect(published.status()).toBe(201)
  await page.waitForTimeout(3200)
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('earlier published revision')
  expect((await ledger()).total).toBe(before+2)
  await page.goto(link)
  await expect(page.getByText('This identifying link belongs to an earlier published revision.',{exact:false})).toBeVisible()
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  expect((await ledger()).total).toBe(before+2)
  await page.screenshot({path:`test-results/${info.project.name}-revision-identity-refused.png`,fullPage:true})
  await proveIdentityWorkspaceIsolation(page,link,flowId,slug)
}

async function proveIdentityWorkspaceIsolation(page:Page,link:string,flowId:string,slug:string) {
  const origin=new URL(link).origin
  const foreign=await page.context().browser()!.newContext({baseURL:origin,viewport:page.viewportSize()!})
  try {
    const other=await foreign.newPage()
    await signInEmptyWorkspace(other)
    const original=await (await page.request.get(`/api/public/flows/${slug}`)).json() as PublicFlow
    const token=new URL(link).searchParams.get('identity')!
    const refusedIssue=await other.request.post(`/api/app/flows/${flowId}/identity-links`,{data:{revisionId:original.revision.id,values:{email:['synthetic-pencil-3','example.test'].join(String.fromCharCode(64))}}})
    expect(refusedIssue.status()).toBe(404)
    const alienSlug=`isolated-${crypto.randomUUID()}`
    const created=await other.request.post('/api/app/flows',{data:{title:'Isolated link form',slug:alienSlug}})
    expect(created.status()).toBe(201)
    const alien=await created.json() as {id:string},base=`/api/app/flows/${alien.id}`
    const read=async()=>await (await other.request.get(`${base}/draft`)).json() as BuilderDraft
    for(const step of [{kind:'question',questionType:'number',prompt:'Isolated number',required:true},{kind:'completion',questionType:null,prompt:'Isolated completion'}]) {
      expect((await other.request.post(`${base}/draft/steps`,{data:{expectedVersion:(await read()).flow.draftVersion,step}})).status()).toBe(201)
    }
    expect((await other.request.put(`${base}/draft/settings`,{data:{expectedVersion:(await read()).flow.draftVersion,settings:original.formSettings}})).status()).toBe(200)
    expect((await other.request.post(`${base}/publish`,{data:{expectedVersion:(await read()).flow.draftVersion}})).status()).toBe(201)
    const denied=await other.request.post(`/api/public/flows/${alienSlug}/sessions`,{data:{deviceClass:'desktop',source:'direct',identityLink:token}})
    expect(denied.status()).toBe(400)
    await other.goto(`/f/${alienSlug}?identity=${encodeURIComponent(token)}`)
    await expect(other.getByText('This identifying link could not be verified.',{exact:false})).toBeVisible()
    await expect(other.getByRole('spinbutton')).toHaveCount(0)
    expect((await (await other.request.get(`${base}/ledger`)).json() as Ledger).total).toBe(0)
  } finally {await foreign.close()}
}
