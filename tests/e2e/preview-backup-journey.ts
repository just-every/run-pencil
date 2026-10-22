import { readFile } from 'node:fs/promises'
import type { Page, APIRequestContext } from '@playwright/test'
import { expect } from './fixtures'
import { appHeaders } from './api-headers'

export async function previewBackupJourney(page: Page, request: APIRequestContext, cookie: string, project: string) {
  const [name,value] = cookie.split('=')
  await page.context().addCookies([{name,value,url:process.env.PENCIL_E2E_BASE_URL!}])
  const call = async (path:string,data:unknown,method='POST') => {
    const response=await request.fetch(path,{method,headers:{...appHeaders,Cookie:cookie},data})
    expect(response.ok(),await response.text()).toBe(true)
    return response.json()
  }
  const form=await call('/api/app/flows',{title:'Harbour Studio archive',slug:`archive-${project}-${Date.now()}`,template:'feedback'})
  const base=`/api/app/flows/${form.id}`
  const draft=async()=> (await request.get(base+'/draft',{headers:{Cookie:cookie}})).json()
  const image={mime:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=',alt:'Harbour Studio mark'}
  await call(base+'/draft/settings',{expectedVersion:(await draft()).flow.draftVersion,settings:{hiddenFields:[],identityMode:'anonymous',linkPreview:{image}}},'PUT')
  await call(base+'/publish',{expectedVersion:(await draft()).flow.draftVersion})
  const key=(await draft()).formSettings.linkPreview.image.key
  await page.goto('/app/backup')
  await expect(page.locator('.operator-shell')).toHaveAttribute('data-hydrated','true')
  const downloaded=page.waitForEvent('download')
  await page.getByRole('button',{name:'Download backup',exact:true}).click()
  const download=await downloaded, buffer=await readFile((await download.path())!)
  const archive=JSON.parse(buffer.toString())
  expect(archive.payload.objects).toContainEqual(expect.objectContaining({key,data:image.base64,mime:image.mime}))
  await page.getByLabel('Pencil backup file',{exact:true}).setInputFiles({name:'harbour-studio.rer',mimeType:'application/json',buffer})
  await page.getByRole('button',{name:'Check backup',exact:true}).click()
  await expect(page.getByText('Backup contents checked.',{exact:true})).toBeVisible()
  const outbound:string[]=[]
  page.on('request',request=>{if(request.method()!=='GET')outbound.push(request.url())})
  await page.getByRole('button',{name:'Test restoration',exact:true}).click()
  await expect(page.getByText('Restoration passed.',{exact:true})).toBeVisible({timeout:30_000})
  await expect(page.getByRole('status').filter({hasText:'Restoration passed.'})).toContainText(archive.sha256)
  expect(outbound).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/${project}-preview-backup.png`,fullPage:true})
}
