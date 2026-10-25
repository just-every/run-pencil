import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect } from './fixtures'
import { contract } from './contract'
import { operatorEmail } from './auth-identity'
contract(['NOTIFY-002','NOTIFY-004','NOTIFY-005','BASE-PUBLIC-003'],'notification preference and failed delivery controls are accessible on desktop and mobile with authenticated results',async({page},info)=>{
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
  const capture=process.env.PENCIL_CAPTURE_DIR
  if(capture)mkdirSync(capture,{recursive:true})
  const request=page.request,headers={Origin:new URL(info.project.use.baseURL!).origin},email=operatorEmail()
  const call=async(path:string,data?:unknown)=>{const response=await request.fetch(path,{method:data===undefined?'GET':'POST',headers,...(data===undefined?{}:{data})});expect(response.ok(),path).toBe(true);return response.json()}
  await call('/auth/magic-link',{email});const inbox=await developmentInbox(path=>request.get(path, { headers: devKeyHeaders }),email)
  expect((await request.post('/auth/confirm',{headers,data:{token:inbox.messages[0].magicLinkToken},maxRedirects:0})).status()).toBe(303)
  const flow=await call('/api/app/flows',{title:'Response notification controls',slug:`notifications-${info.project.name}-${Date.now()}`}),path=`/api/app/flows/${flow.id}`
  for(const step of [{kind:'question',questionType:'short_text',prompt:'Feedback',required:true},{kind:'question',questionType:'nps',prompt:'Recommend us',required:true},{kind:'completion',questionType:null,prompt:'Recorded'}]) await call(`${path}/draft/steps`,{expectedVersion:(await call(`${path}/draft`)).flow.draftVersion,step})
  const receiver=createServer((incoming,outgoing)=>{incoming.resume();incoming.on('end',()=>{outgoing.writeHead(200,{'content-type':'application/json'});outgoing.end(JSON.stringify({ok:true}))})})
  await new Promise<void>(resolve=>receiver.listen(0,'127.0.0.1',resolve))
  const receiverOrigin=`http://127.0.0.1:${(receiver.address() as AddressInfo).port}`
  try {
  const put=async(path:string,data:unknown)=>{const response=await request.put(path,{headers,data});expect(response.ok(),path).toBe(true);return response.json()}
  const operators=await call('/api/app/operators'),chatOwner=operators.find((operator:{email:string})=>operator.email===email)??operators[0]
  await Promise.all([put('/api/app/connections/slack',{botToken:'synthetic-pencil-chat-bot',signingSecret:'synthetic-pencil-chat-signing-secret',apiOrigin:receiverOrigin}),put('/api/app/connections/teams',{webhookUrl:receiverOrigin+'/teams'})])
  await Promise.all(['slack','teams'].map(platform=>put(path+'/chat',{platform,postResponses:platform==='slack',answerStepIds:[],operatorId:chatOwner.id,...(platform==='slack'?{channel:'synthetic-pencil-channel',slackUserId:'synthetic-pencil-slack-user'}:{teamsUserId:'synthetic-pencil-microsoft-user'})})))
  const draft=await call(`${path}/draft`),nps=draft.steps.find((step:{questionType:string})=>step.questionType==='nps')
  await call(`${path}/publish`,{expectedVersion:draft.flow.draftVersion})
  await page.goto(`/app/flows/${flow.id}/builder`)
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  await page.locator('.step-button').filter({hasText:'Recorded'}).click()
  await page.getByText('Slack and Teams notifications',{exact:true}).click()
  const postEvery=page.getByRole('checkbox',{name:'Post every released response',exact:true})
  await expect(postEvery).toBeChecked()
  const chatSettings=postEvery.locator('..').locator('..')
  await postEvery.uncheck()
  await chatSettings.getByRole('button',{name:'Save chat settings',exact:true}).click()
  await expect(chatSettings.getByRole('status')).toBeVisible()
  const chatTargets=await call(path+'/chat')
  expect(chatTargets.links.find((link:{platform:string})=>link.platform==='slack')).toMatchObject({postResponses:false,armed:true})
  await page.getByText('Answer alerts',{exact:true}).click()
  await page.getByRole('button',{name:'Add alert rule',exact:true}).click()
  const rule=page.getByRole('group',{name:'Alert 1',exact:true})
  await rule.getByLabel('Rule name',{exact:true}).fill('Detractor follow-up')
  await rule.getByLabel('Question',{exact:true}).selectOption(nps.id)
  await rule.getByLabel('Condition',{exact:true}).selectOption('less_than_or_equal')
  await rule.getByLabel('Value',{exact:true}).fill('6')
  await rule.locator('label').filter({hasText:email}).getByRole('checkbox').check()
  await rule.getByRole('checkbox',{name:'Send to Slack',exact:true}).check()
  await rule.getByRole('checkbox',{name:'Send to Teams',exact:true}).check()
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    await page.setViewportSize(viewport)
    await expect(rule.getByLabel('Rule name',{exact:true})).toBeVisible()
    await expect(rule.getByRole('checkbox',{name:'Send to Slack',exact:true})).toBeChecked()
    await expect(rule.getByRole('checkbox',{name:'Send to Teams',exact:true})).toBeChecked()
    await expect(postEvery).not.toBeChecked()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
    await page.screenshot({path:capture?join(capture,`answer-alert-settings-${viewport.width}-${info.project.name}.png`):info.outputPath(`answer-alert-settings-${viewport.width}.png`),fullPage:true,scale:'css'})
  }
  const builderUrl=page.url()
  const beforeSave=await call(`${path}/draft`)
  let leaveDialog:string|undefined
  page.once('dialog',async dialog=>{leaveDialog=dialog.type();await dialog.dismiss()})
  await page.getByRole('link',{name:'Results',exact:true}).click()
  expect(leaveDialog).toBe('confirm')
  await expect(page).toHaveURL(builderUrl)
  await expect(rule.getByLabel('Rule name',{exact:true})).toHaveValue('Detractor follow-up')
  expect((await call(`${path}/draft`)).formSettings.answerAlerts).toEqual(beforeSave.formSettings.answerAlerts)
  // A real competing write refuses the stale version; Retry applies the retained rules to that draft.
  await put(`${path}/draft/settings`,{expectedVersion:beforeSave.flow.draftVersion,settings:beforeSave.formSettings})
  await page.getByRole('button',{name:'Save alert rules',exact:true}).click()
  const alertSettings=page.locator('.answer-alert-settings')
  await expect(alertSettings.getByRole('alert')).toBeVisible()
  await expect(rule.getByLabel('Rule name',{exact:true})).toHaveValue('Detractor follow-up')
  expect((await call(`${path}/draft`)).formSettings.answerAlerts).toEqual(beforeSave.formSettings.answerAlerts)
  await alertSettings.getByRole('button',{name:'Retry',exact:true}).click()
  await expect(alertSettings.getByRole('status')).toBeVisible()
  await expect.poll(async()=>((await call(`${path}/draft`)).formSettings.answerAlerts??[]).length).toBe(1)
  const saved=await call(`${path}/draft`)
  expect(saved.formSettings.answerAlerts).toMatchObject([{name:'Detractor follow-up',condition:{stepId:nps.id,operator:'less_than_or_equal',value:6},recipientIds:expect.any(Array),chatPlatforms:['slack','teams']}])
  await call(`${path}/publish`,{expectedVersion:saved.flow.draftVersion})
  await page.goto(`/app/flows/${flow.id}/results`)
  const choice=page.getByLabel('Email me about completed responses')
  await expect(choice).toHaveValue('immediately')
  await choice.selectOption('off');await expect(page.getByText('Your notification preference is saved.')).toBeVisible()
  await page.reload();await expect(choice).toHaveValue('off')
  await choice.selectOption('immediately');await expect(page.getByText('Your notification preference is saved.')).toBeVisible()
  const directory=process.env.PENCIL_MIGRATION_STATE!,db=new DatabaseSync(join(directory,readdirSync(directory).find(name=>name.endsWith('.sqlite'))!))
  try {
    db.exec('PRAGMA busy_timeout=1000')
    const operator=db.prepare('SELECT id FROM operators WHERE email=?').get(email)!,revision=db.prepare("SELECT id FROM flow_revisions WHERE flow_id=? AND state='published'").get(flow.id)!,workspace=db.prepare('SELECT workspace_id FROM flows WHERE id=?').get(flow.id)!,now=new Date().toISOString(),responseId=crypto.randomUUID(),deliveryId=crypto.randomUUID()
    db.prepare(`INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,completed_at,created_at,updated_at,notification_eligible) VALUES(?,?,?,?,?,?,?,'released',?,?,?,1)`).run(responseId,workspace.workspace_id,flow.id,revision.id,crypto.randomUUID(),'synthetic-hash',crypto.randomUUID(),now,now,now)
    db.prepare(`INSERT INTO notification_deliveries(id,response_id,operator_id,status,idempotency_key,available_at,reason,created_at,updated_at) VALUES(?,?,?,'failed',?,?,'Mail provider rejected this operator notification.',?,?)`).run(deliveryId,responseId,operator.id,deliveryId,now,now,now)
    const alertId=crypto.randomUUID()
    db.prepare(`INSERT INTO answer_alert_deliveries(id,response_id,rule_id,rule_name,operator_id,status,idempotency_key,available_at,created_at,updated_at) VALUES(?,?,?,'Detractor follow-up',?,'sent',?,?,?,?)`).run(alertId,responseId,saved.formSettings.answerAlerts[0].id,operator.id,crypto.randomUUID(),now,now,now)
    await page.getByRole('button',{name:'Refresh answer alerts',exact:true}).click()
    await expect(page.getByRole('region',{name:'Answer alert attention'}).getByText('Detractor follow-up',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Mark alert as read',exact:true}).click()
    await expect(page.getByText('Alert marked as read.',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Refresh delivery status'}).click()
    await expect(page.getByText('Mail provider rejected this operator notification.')).toBeVisible()
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      await page.setViewportSize(viewport)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
      const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([])
      await page.screenshot({path:capture?join(capture,`notifications-${viewport.width}-${info.project.name}.png`):info.outputPath(`notifications-${viewport.width}.png`),fullPage:true,scale:'css'})
    }
    await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByText('Retry queued with the original delivery key.')).toBeVisible()
    await expect.poll(()=>db.prepare('SELECT status,idempotency_key FROM notification_deliveries WHERE id=?').get(deliveryId)).toEqual({status:'sent',idempotency_key:deliveryId})
    db.prepare("UPDATE notification_deliveries SET status='unknown' WHERE id=?").run(deliveryId)
    await page.getByRole('button',{name:'Refresh delivery status'}).click();await expect(page.getByRole('button',{name:'Send again'})).toBeVisible()
    page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Send again'}).click();expect(db.prepare('SELECT status FROM notification_deliveries WHERE id=?').get(deliveryId)?.status).toBe('unknown')
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Send again'}).click();await expect(page.getByText('Retry queued with the original delivery key.')).toBeVisible()
    await expect.poll(()=>db.prepare('SELECT status,idempotency_key FROM notification_deliveries WHERE id=?').get(deliveryId)).toEqual({status:'sent',idempotency_key:deliveryId})
  }finally{db.close()}
  } finally {
    try {
      await Promise.all(['slack','teams'].map(async platform=>{
        await request.delete(path+'/chat/'+platform,{headers,data:{}})
        await request.delete('/api/app/connections/'+platform,{headers,data:{}})
      }))
    } finally {await new Promise<void>(resolve=>{receiver.closeAllConnections();receiver.close(()=>resolve())})}
  }
})
