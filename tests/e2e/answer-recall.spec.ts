import { mkdir } from 'node:fs/promises'
import { contract } from './contract'
import { expect } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import type { BuilderDraft } from '../../src/core/app/api'

contract('LOGIC-001', 'a buyer inserts an earlier answer, previews it, edits it by going back and submits inert recalled text', async ({page},info) => {
  await signInEmptyWorkspace(page)
  const origin=new URL(info.project.use.baseURL!).origin
  const call=async <T,>(path:string,data?:unknown,method='POST')=>{const r=await page.request.fetch(path,{method:data===undefined?'GET':method,headers:{Origin:origin},...(data===undefined?{}:{data})});expect(r.status(),await r.text()).toBeLessThan(300);return await r.json() as T}
  const slug=`personal-feedback-${info.project.name}-${Date.now()}`, created=await call<{id:string}>('/api/app/flows',{title:'Your next appointment',slug}), path=`/api/app/flows/${created.id}`
  await call(`${path}/draft/steps`,{expectedVersion:0,step:{kind:'question',questionType:'short_text',prompt:'What should we call you?',required:true}})
  let d=await call<BuilderDraft>(`${path}/draft`);const name=d.steps[0]
  await call(`${path}/draft/steps`,{expectedVersion:d.flow.draftVersion,step:{kind:'question',questionType:'single_choice',prompt:'What works best for ',required:true,choices:[{value:'morning',label:`Morning for {{${name.id}}}`},{value:'evening',label:`Evening for {{${name.id}}}`} ]}})
  d=await call<BuilderDraft>(`${path}/draft`); const preference=d.steps[1]
  await call(`${path}/draft/steps`,{expectedVersion:d.flow.draftVersion,step:{kind:'completion',questionType:null,prompt:`Thanks {{${name.id}}}: {{${preference.id}}}`}})
  await page.goto(`/app/flows/${created.id}/builder`)
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  await page.locator('.step-button').nth(1).click()
  await page.getByText('Insert an earlier answer',{exact:true}).click()
  await page.getByRole('button',{name:'Insert answer: What should we call you?'}).click()
  await page.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  const shots=process.env.PENCIL_PROOF_DIR
  const shot=async(state:string)=>{if(shots){await mkdir(shots,{recursive:true});await page.screenshot({path:`${shots}/recall-${state}-${info.project.name}.png`,fullPage:true})}expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
  await shot('builder')
  await page.getByRole('button',{name:'Preview draft',exact:true}).click()
  const preview=page.getByRole('region',{name:'Draft preview'})
  await preview.getByRole('textbox',{name:name.prompt}).fill('Jo')
  await preview.getByRole('button',{name:'Continue preview',exact:true}).click()
  await expect(preview.getByRole('heading',{name:'What works best for Jo'})).toBeVisible()
  await expect(preview.getByRole('radio',{name:'Morning for Jo'})).toBeVisible()
  await shot('preview')
  await preview.getByRole('button',{name:'Close preview'}).click()
  d=await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`,{expectedVersion:d.flow.draftVersion})
  await page.goto(`/f/${slug}`)
  await page.getByRole('textbox',{name:name.prompt}).fill('Jo')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('heading',{name:'What works best for Jo'})).toBeVisible()
  await page.getByRole('button',{name:'Back',exact:true}).click()
  await page.getByRole('textbox',{name:name.prompt}).fill('<script>window.recallRan=true</script>')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('heading',{name:'What works best for <script>window.recallRan=true</script>'})).toBeVisible()
  expect(await page.evaluate(()=>Object.hasOwn(window,'recallRan'))).toBe(false)
  await page.getByRole('button',{name:'Back',exact:true}).click()
  await page.getByRole('textbox',{name:name.prompt}).fill('Jordan')
  await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('radio',{name:'Evening for Jordan'}).click()
  await shot('answer')
  await page.waitForTimeout(3200)
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Thanks Jordan: Evening for Jordan'})).toBeVisible()
  await shot('completed')
})
