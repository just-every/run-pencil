import { contract } from './contract'
import { expect } from './fixtures'
import { operatorEmail } from './auth-identity'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'

contract(['NOTIFY-002','NOTIFY-004'],'a public response sends without a Cron tick and concurrent requests plus Cron deliver it once',async({page},info)=>{
  const email=operatorEmail(), headers={Origin:new URL(info.project.use.baseURL!).origin}
  const call=async(path:string,data?:unknown)=>{
    const response=await page.request.fetch(path,{method:data===undefined?'GET':'POST',headers,...(data===undefined?{}:{data})})
    expect(response.ok(),path).toBe(true)
    return response.json()
  }
  await call('/auth/magic-link',{email})
  const inbox=await developmentInbox(path=>page.request.get(path,{headers:devKeyHeaders}),email)
  expect((await page.request.post('/auth/confirm',{headers,data:{token:inbox.messages[0].magicLinkToken},maxRedirects:0})).status()).toBe(303)
  const slug=`request-notice-${Date.now()}`,flow=await call('/api/app/flows',{title:'Harbour Bakery feedback',slug}),path=`/api/app/flows/${flow.id}`
  for(const step of [{kind:'question',questionType:'short_text',prompt:'What could we improve?',required:true},{kind:'completion',questionType:null,prompt:'Thank you'}]) await call(`${path}/draft/steps`,{expectedVersion:(await call(`${path}/draft`)).flow.draftVersion,step})
  await call(`${path}/publish`,{expectedVersion:(await call(`${path}/draft`)).flow.draftVersion})
  const previousTimer=(await call(`${path}/notifications`)).timerLastStartedAt
  await page.goto(`/f/${slug}`)
  await page.locator('textarea,input[type=text]').first().fill('A clearer sign for the collection counter would help.')
  // A real person must have had enough time to read and answer the question.
  await page.waitForTimeout(3500)
  await page.getByRole('button',{name:'Submit response'}).click()
  await expect(page.getByText('This public link cannot edit a completed response.')).toBeVisible()
  await expect.poll(async()=>(await call(`${path}/notifications`)).deliveries).toMatchObject([{status:'sent',attempts:1}])
  expect((await call(`${path}/notifications`)).timerLastStartedAt).toBe(previousTimer)
  await Promise.all([
    page.request.post('/__test/cron',{headers:devKeyHeaders}),
    call(`${path}/notifications`),call(`${path}/results`),
  ])
  const state=await call(`${path}/notifications`)
  expect(state.timerLastStartedAt).not.toBeNull()
  expect(state.deliveries).toHaveLength(1)
  expect(state.deliveries[0]).toMatchObject({status:'sent',attempts:1})
  const mail=await page.request.get('/__test/mail',{headers:devKeyHeaders})
  const messages=(await mail.json()).messages.filter((message:{text?:string})=>message.text?.includes(`/app/flows/${flow.id}/results`))
  expect(messages).toHaveLength(1)
  await page.goto(`/app/flows/${flow.id}/results`)
  await expect(page.getByText('Local development suppresses email.',{exact:false})).toBeVisible()
})
