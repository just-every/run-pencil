import type { Page, APIRequestContext } from '@playwright/test'
import { expect } from './fixtures'
import { appHeaders } from './api-headers'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=', 'base64')
export async function publishedPreviewJourney(page: Page, request: APIRequestContext, cookie: string, project: string) {
  const origin = process.env.PENCIL_E2E_BASE_URL!, slug = `harbour-preview-${project}-${Date.now()}`
  const call = async (path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST') => {
    const response = await request.fetch(path,{method,headers:{...appHeaders,Cookie:cookie},...(data === undefined ? {} : {data})})
    expect(response.ok(),`${path}: ${await response.text()}`).toBe(true)
    return response.status() === 204 ? undefined : response.json()
  }
  const created = await call('/api/app/flows',{title:'Harbour Studio feedback',slug}), base=`/api/app/flows/${created.id}`
  const draft = () => call(base+'/draft')
  const save = async (settings: unknown) => call(base+'/draft/settings',{expectedVersion:(await draft()).flow.draftVersion,settings},'PUT')
  const publish = async () => call(base+'/publish',{expectedVersion:(await draft()).flow.draftVersion})
  for (const step of [
    {kind:'welcome',questionType:null,prompt:'Help shape our studio',helperText:'Your feedback makes a difference.'},
    {kind:'question',questionType:'short_text',prompt:'What should we improve?',required:true},
    {kind:'completion',questionType:null,prompt:'Thank you for helping our studio.'},
  ]) await call(base+'/draft/steps',{expectedVersion:(await draft()).flow.draftVersion,step})
  const first=await publish(), canonical=new URL('/f/'+slug,origin).href
  const inspect = async (path: string) => {
    const response=await request.get(path,{headers:{Cookie:''}}),html=await response.text()
    const head=await page.evaluate(html=>{const document=new DOMParser().parseFromString(html,'text/html');return {title:document.title,meta:Object.fromEntries([...document.head.querySelectorAll('meta')].map(m=>[m.getAttribute('property')??m.getAttribute('name'),m.getAttribute('content')]))}},html)
    return {...head,html,status:response.status(),robots:response.headers()['x-robots-tag']}
  }
  const initial=await inspect(canonical)
  expect(initial.status).toBe(200)
  expect(initial).toMatchObject({title:'Harbour Studio feedback',robots:'noindex',meta:{'og:title':'Harbour Studio feedback','og:description':'Help shape our studio Your feedback makes a difference.','og:url':canonical,'twitter:card':'summary_large_image',robots:'noindex, nofollow'}})
  expect(new URL(initial.meta['og:image']!).origin).toBe(new URL(origin).origin)
  expect((await request.get(initial.meta['og:image']!)).ok()).toBe(true)
  const settings={hiddenFields:[],identityMode:'anonymous',linkPreview:{title:'A better studio, together',description:'Share an idea for your next visit.',image:{mime:'image/png',base64:png.toString('base64'),alt:'Harbour Studio mark'},allowIndexing:true}}
  await save(settings)
  expect((await inspect(canonical)).meta['og:title']).toBe(initial.meta['og:title'])
  await publish()
  const publicPreview=await inspect(canonical)
  expect(publicPreview).toMatchObject({title:settings.linkPreview.title,meta:{'og:title':settings.linkPreview.title,'og:description':settings.linkPreview.description,'og:image:alt':settings.linkPreview.image.alt,'og:url':canonical,'twitter:card':'summary_large_image'}})
  expect(publicPreview.meta.robots).toBeUndefined();expect(publicPreview.robots).toBeUndefined()
  const image=await request.get(publicPreview.meta['og:image']!);expect(image.headers()['content-type']).toBe('image/png');expect(await image.body()).toEqual(png)
  const collector=await call(base+'/collectors',{name:'Studio newsletter',channel:'email'})
  for(const path of [`/embed/${slug}`,`/f/${slug}?collector=${collector.publicKey}`,`/f/${slug}?utm_campaign=PRIVATE_RECALLED_VALUE`,`/f/${slug}?kiosk=60`,`/f/${slug}?completed=1`]){
    const result=await inspect(path)
    expect(result.status).toBe(200)
    expect(result.meta).toMatchObject({'og:title':settings.linkPreview.title,'og:url':canonical,robots:'noindex, nofollow'})
    expect(result.robots).toBe('noindex')
    expect(JSON.stringify(result.meta)).not.toContain('PRIVATE_RECALLED_VALUE')
  }
  for(const path of [`/f/${slug}?resume=${'a'.repeat(64)}`,`/f/${slug}?payment-key=${'b'.repeat(64)}&payment-return=success`,`/i/${'c'.repeat(64)}`]){
    const result=await inspect(path);expect(result.robots).toBe('noindex');expect(result.meta.robots).toBe('noindex, nofollow')
  }
  // The header follows the same decision on HEAD, and iframe admission is still enforced.
  expect((await request.head(canonical)).headers()['x-robots-tag']).toBeUndefined()
  const denied=await request.get(`/embed/${slug}`,{headers:{Referer:'https://untrusted.example/page','Sec-Fetch-Dest':'iframe'}})
  expect(denied.status()).toBe(403);expect(denied.headers()['x-robots-tag']).toBe('noindex')
  const outbound:string[]=[]
  page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(origin).origin)outbound.push(r.url())})
  await page.goto(canonical)
  await expect(page.getByRole('heading',{name:'Help shape our studio'})).toBeVisible()
  await page.getByRole('button',{name:'Begin',exact:true}).click()
  await page.getByRole('textbox',{name:'What should we improve?'}).fill('Keep the quiet afternoon sessions.')
  await page.waitForTimeout(3100)
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Thank you for helping our studio.'})).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow')
  expect(new URL(page.url()).searchParams.get('completed')).toBe('1')
  expect((await request.get(page.url())).headers()['x-robots-tag']).toBe('noindex')
  expect(await page.locator('meta[property="og:description"]').getAttribute('content')).not.toContain('quiet afternoon')
  expect(outbound).toEqual([])
  await page.screenshot({path:`test-results/${project}-preview-completion.png`,fullPage:true})
  await call(base+'/access',{expectedVersion:(await draft()).flow.draftVersion,rule:{mode:'password',password:'synthetic-pencil-1'}},'PUT')
  const restricted=await draft()
  const refused=await request.post(base+'/publish',{headers:{...appHeaders,Cookie:cookie},data:{expectedVersion:restricted.flow.draftVersion}})
  expect(refused.status()).toBe(400)
  await save({...restricted.formSettings,linkPreview:{...restricted.formSettings.linkPreview,allowIndexing:false}})
  await publish()
  const protectedPage=await inspect(canonical)
  expect(protectedPage.meta).toMatchObject({'og:title':settings.linkPreview.title,robots:'noindex, nofollow'})
  expect(protectedPage.robots).toBe('noindex');expect(protectedPage.html).not.toContain('What should we improve?')
  expect((await request.get(`/api/public/flows/${slug}`,{headers:{Cookie:''}})).status()).toBe(403)
  expect((await request.post(`/api/public/flows/${slug}/sessions`,{headers:appHeaders,data:{source:'direct',deviceClass:'desktop'}})).status()).toBe(400)
  expect((await request.get(`/api/public/previews/${first.revision.id}/image`)).ok()).toBe(true)
}
