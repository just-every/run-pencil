import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect } from './fixtures'
import { contract } from './contract'
import { operatorEmail } from './auth-identity'
contract(['NOTIFY-002','NOTIFY-004','BASE-PUBLIC-003'],'notification preference and failed delivery controls are accessible on desktop and mobile with authenticated results',async({page},info)=>{
  const request=page.request,headers={Origin:new URL(info.project.use.baseURL!).origin},email=operatorEmail()
  const call=async(path:string,data?:unknown)=>{const response=await request.fetch(path,{method:data===undefined?'GET':'POST',headers,...(data===undefined?{}:{data})});expect(response.ok(),path).toBe(true);return response.json()}
  await call('/auth/magic-link',{email});const inbox=await developmentInbox(path=>request.get(path, { headers: devKeyHeaders }),email)
  expect((await request.post('/auth/confirm',{headers,data:{token:inbox.messages[0].magicLinkToken},maxRedirects:0})).status()).toBe(303)
  const flow=await call('/api/app/flows',{title:'Response notification controls',slug:`notifications-${info.project.name}-${Date.now()}`}),path=`/api/app/flows/${flow.id}`
  for(const step of [{kind:'question',questionType:'short_text',prompt:'Feedback',required:true},{kind:'completion',questionType:null,prompt:'Recorded'}]) await call(`${path}/draft/steps`,{expectedVersion:(await call(`${path}/draft`)).flow.draftVersion,step})
  await call(`${path}/publish`,{expectedVersion:(await call(`${path}/draft`)).flow.draftVersion})
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
    await page.getByRole('button',{name:'Refresh delivery status'}).click()
    await expect(page.getByText('Mail provider rejected this operator notification.')).toBeVisible()
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      await page.setViewportSize(viewport)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
      const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([])
      await page.screenshot({path:info.outputPath(`notifications-${viewport.width}.png`),fullPage:true})
    }
    await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByText('Retry queued with the original delivery key.')).toBeVisible()
    expect(db.prepare('SELECT status,idempotency_key FROM notification_deliveries WHERE id=?').get(deliveryId)).toEqual({status:'pending',idempotency_key:deliveryId})
    db.prepare("UPDATE notification_deliveries SET status='unknown' WHERE id=?").run(deliveryId)
    await page.getByRole('button',{name:'Refresh delivery status'}).click();await expect(page.getByRole('button',{name:'Send again'})).toBeVisible()
    page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Send again'}).click();expect(db.prepare('SELECT status FROM notification_deliveries WHERE id=?').get(deliveryId)?.status).toBe('unknown')
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Send again'}).click();await expect(page.getByText('Retry queued with the original delivery key.')).toBeVisible()
    expect(db.prepare('SELECT status,idempotency_key FROM notification_deliveries WHERE id=?').get(deliveryId)).toEqual({status:'pending',idempotency_key:deliveryId})
  }finally{db.close()}
})
