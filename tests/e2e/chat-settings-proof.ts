import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page,TestInfo } from '@playwright/test'
import type { BuilderDraft,Operator } from '../../src/core/app/api'
import { expect } from './fixtures'

/** The owner's existing Settings and builder doors at both supported widths; credentials are never returned to the document. */
export async function proveChatSettings(page:Page,info:TestInfo){
  const origin=new URL(info.project.use.baseURL!).origin
  const receiver=createServer((request,response)=>{request.resume();request.on('end',()=>{response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({ok:true}))})})
  await new Promise<void>(resolve=>receiver.listen(0,'127.0.0.1',resolve))
  const receiverOrigin=`http://127.0.0.1:${(receiver.address() as AddressInfo).port}`
  const request=async<T>(path:string,method='GET',data?:unknown)=>{const response=await page.request.fetch(path,{method,headers:{Origin:origin},...(data===undefined?{}:{data})});expect(response.status(),await response.text()).toBeLessThan(300);return response.status()===204?undefined as T:response.json() as Promise<T>}
  const capture=async(label:string)=>{if(process.env.PENCIL_CAPTURE_DIR){await mkdir(process.env.PENCIL_CAPTURE_DIR,{recursive:true});await page.screenshot({path:join(process.env.PENCIL_CAPTURE_DIR,`integ006-${label}-${page.viewportSize()!.width}.png`),fullPage:true})}else await page.screenshot({path:info.outputPath(`chat-${label}-${page.viewportSize()!.width}.png`),fullPage:true})}
  let flowId:string|undefined
  try{
    await page.goto('/app/settings');await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    const card=page.getByRole('region',{name:'Slack and Teams',exact:true})
    await card.getByText('Slack connection',{exact:true}).click()
    await card.getByLabel('Slack bot token',{exact:true}).fill('synthetic-pencil-chat-bot')
    await card.getByLabel('Slack signing secret',{exact:true}).fill('synthetic-pencil-chat-signing-secret')
    await card.getByRole('button',{name:'Save Slack connection',exact:true}).click()
    await expect(card.getByRole('status')).toContainText('Slack connection saved')
    await expect(card.getByLabel('Slack bot token',{exact:true})).toHaveValue('')
    await expect(card.getByLabel('Slack signing secret',{exact:true})).toHaveValue('')
    // All subsequent posts, should any be queued, go only to the loopback fixture.
    await request('/api/app/connections/slack','PUT',{botToken:'synthetic-pencil-chat-bot',signingSecret:'synthetic-pencil-chat-signing-secret',apiOrigin:receiverOrigin})
    await card.getByText('Teams connection',{exact:true}).click()
    await card.getByLabel('Teams incoming webhook',{exact:true}).fill(receiverOrigin+'/teams')
    await card.getByRole('button',{name:'Save Teams connection',exact:true}).click()
    await expect(card.getByRole('status')).toContainText('Teams connection saved')
    await expect(card.getByLabel('Teams incoming webhook',{exact:true})).toHaveValue('')
    expect(await page.content()).not.toContain('synthetic-pencil-chat-signing-secret')
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);await card.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await capture('connections')}
    const flow=await request<{id:string}>('/api/app/flows','POST',{title:'Chat settings proof',slug:`chat-settings-${info.project.name}-${Date.now()}`});flowId=flow.id
    const draft=()=>request<BuilderDraft>(`/api/app/flows/${flow.id}/draft`)
    for(const step of [{kind:'question',questionType:'single_choice',prompt:'Visit rating',required:true,choices:[{value:'good',label:'Good'},{value:'poor',label:'Poor'}]},{kind:'question',questionType:'email',prompt:'Private mailbox',required:false},{kind:'completion',questionType:null,prompt:'Chat settings complete'}])await request(`/api/app/flows/${flow.id}/draft/steps`,'POST',{expectedVersion:(await draft()).flow.draftVersion,step})
    const operators=await request<Operator[]>('/api/app/operators')
    await page.goto(`/app/flows/${flow.id}/builder`);await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    await page.getByRole('button',{name:/Chat settings complete Completion/}).click()
    const service=page.getByRole('combobox',{name:'Chat service',exact:true}),settings=service.locator('..').locator('..')
    await page.getByText('Slack and Teams notifications',{exact:true}).click()
    await expect(service).toBeEnabled()
    await settings.getByRole('textbox',{name:'Slack channel ID',exact:true}).fill('synthetic-pencil-channel')
    await settings.getByRole('textbox',{name:'Owner’s Slack user ID',exact:true}).fill('synthetic-pencil-slack-user')
    await settings.getByRole('checkbox',{name:'Visit rating',exact:true}).check()
    await expect(settings.getByRole('checkbox',{name:'Private mailbox',exact:true})).toHaveCount(0)
    const chatBefore=await request(`/api/app/flows/${flow.id}/chat`)
    const chatWrites:string[]=[]
    const recordChatWrite=(request:import('@playwright/test').Request)=>{if(request.method()==='PUT'&&new URL(request.url()).pathname===`/api/app/flows/${flow.id}/chat`)chatWrites.push(request.url())}
    page.on('request',recordChatWrite)
    await settings.getByRole('button',{name:'Save chat settings',exact:true}).click()
    const ownerField=settings.getByRole('combobox',{name:'Action owner',exact:true}),fieldAlert=settings.getByRole('alert')
    await expect(fieldAlert).toBeVisible()
    const description=await fieldAlert.getAttribute('id')
    expect(description).toBeTruthy()
    expect((await ownerField.getAttribute('aria-describedby'))?.split(' ')).toContain(description)
    await expect(settings.getByRole('button',{name:'Retry',exact:true})).toHaveCount(0)
    expect(chatWrites).toHaveLength(0)
    expect(await request(`/api/app/flows/${flow.id}/chat`)).toEqual(chatBefore)
    await ownerField.selectOption(operators[0].id)
    page.off('request',recordChatWrite)
    await settings.getByRole('button',{name:'Save chat settings',exact:true}).click()
    await expect(settings.getByRole('status')).toBeVisible()
    expect((await request<{links:Array<{platform:string;slackUserId:string;armed:boolean}>}>(`/api/app/flows/${flow.id}/chat`)).links.find(link=>link.platform==='slack')).toMatchObject({slackUserId:'synthetic-pencil-slack-user',armed:true})
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);await settings.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await capture('slack-form')}
    await service.selectOption('teams')
    // The real server refuses a Teams target while the workspace has no Teams connection; the panel's own Discard is the way out.
    await request('/api/app/connections/teams','DELETE',{})
    const teamsBefore=await request(`/api/app/flows/${flow.id}/chat`),publish=page.getByRole('button',{name:'Publish',exact:true})
    await settings.getByRole('combobox',{name:'Action owner',exact:true}).selectOption(operators[0].id)
    await settings.getByRole('textbox',{name:'Owner’s Microsoft user ID',exact:true}).fill('synthetic-pencil-microsoft-user')
    chatWrites.length=0;page.on('request',recordChatWrite)
    const refused=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname===`/api/app/flows/${flow.id}/chat`)
    await settings.getByRole('button',{name:'Save chat settings',exact:true}).click()
    expect((await refused).status()).toBe(400)
    await expect(settings.getByRole('alert')).toBeVisible()
    await expect(settings.getByRole('button',{name:'Retry',exact:true})).toHaveCount(0)
    await expect(publish).toBeDisabled()
    expect(await request(`/api/app/flows/${flow.id}/chat`)).toEqual(teamsBefore)
    await settings.getByRole('button',{name:'Discard changes',exact:true}).click()
    await expect(publish).toBeEnabled()
    await expect(settings.getByRole('alert')).toHaveCount(0)
    expect(chatWrites).toHaveLength(1)
    page.off('request',recordChatWrite)
    await request('/api/app/connections/teams','PUT',{webhookUrl:receiverOrigin+'/teams'})
    await settings.getByRole('combobox',{name:'Action owner',exact:true}).selectOption(operators[0].id)
    await settings.getByRole('textbox',{name:'Owner’s Microsoft user ID',exact:true}).fill('synthetic-pencil-microsoft-user')
    await settings.getByRole('button',{name:'Save chat settings',exact:true}).click()
    await expect(settings.getByRole('status')).toBeVisible()
    expect((await request<{links:Array<{platform:string;teamsUserId:string;armed:boolean}>}>(`/api/app/flows/${flow.id}/chat`)).links.find(link=>link.platform==='teams')).toMatchObject({teamsUserId:'synthetic-pencil-microsoft-user',armed:true})
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);await settings.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await capture('teams-form')}
  }finally{
    try{
      if(flowId)for(const platform of ['slack','teams'])await request(`/api/app/flows/${flowId}/chat/${platform}`,'DELETE',{})
      for(const platform of ['slack','teams'])await request(`/api/app/connections/${platform}`,'DELETE',{})
    }finally{await new Promise<void>(resolve=>{receiver.closeAllConnections();receiver.close(()=>resolve())})}
  }
}
