import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { openStateDatabase, stateDatabaseFile } from './state-database'
import { operatorEmail } from './auth-identity'
import { expect } from './fixtures'
import { contract } from './contract'
contract(['DIST-008','DIST-010','BASE-OPS-004'], 'a real sender failure is visible and an explicit duplicate-risk retry retains its durable key and history', async ({ page }, info) => {
  const request=page.request, headers={Origin:new URL(info.project.use.baseURL!).origin}
  const call=async(path:string,data?:unknown)=>{
    const response=await request.fetch(path,{method:data===undefined?'GET':'POST',headers,...(data===undefined?{}:{data})})
    expect(response.ok(),path).toBe(true); return response.json()
  }
  await call('/auth/magic-link',{email:operatorEmail()})
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), operatorEmail())
  expect((await request.post('/auth/confirm',{headers,data:{token:inbox.messages[0].magicLinkToken},maxRedirects:0})).status()).toBe(303)
  const flow=await call('/api/app/flows',{title:'Synthetic mail recovery',slug:`mail-recovery-${info.project.name}-${Date.now()}`})
  const path=`/api/app/flows/${flow.id}`
  for(const step of [{kind:'question',questionType:'short_text',prompt:'Feedback',required:true},{kind:'completion',questionType:null,prompt:'Recorded'}]) await call(`${path}/draft/steps`,{expectedVersion:(await call(`${path}/draft`)).flow.draftVersion,step})
  await call(`${path}/publish`,{expectedVersion:(await call(`${path}/draft`)).flow.draftVersion})
  const contact=await call('/api/app/distribution/contacts',{name:'Synthetic recovery recipient',email:`recovery-${flow.id}@example.test`})
  const directory=process.env.PENCIL_MIGRATION_STATE!,db=openStateDatabase(stateDatabaseFile(directory))
  try {
    db.exec(`CREATE TRIGGER synthetic_mail_failure BEFORE INSERT ON rer_mail_development_outbox BEGIN SELECT RAISE(ABORT,'synthetic-private-provider-error'); END`)
    await call(`${path}/distribution`,{contactIds:[contact.id],commandKey:`recovery-${info.project.name}`})
    db.exec('DROP TRIGGER synthetic_mail_failure')
    const before=db.prepare('SELECT d.id,d.idempotency_key,d.status FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id WHERE p.contact_id=?').get(contact.id)!
    expect(before.status).toBe('unknown')
    await page.goto(`/app/flows/${flow.id}/builder`)
    await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    await page.getByRole('button',{name:'Share',exact:true}).click()
    await expect(page.getByText(/invitation: unknown/)).toBeVisible()
    await expect(page.getByText(/synthetic-private-provider-error/)).toHaveCount(0)
    page.once('dialog',dialog=>dialog.dismiss())
    await page.getByRole('button',{name:'Queue retry (duplicate risk)'}).click()
    expect(db.prepare('SELECT status,attempts FROM mail_deliveries WHERE id=?').get(before.id)).toEqual({status:'unknown',attempts:1})
    page.once('dialog',dialog=>dialog.accept())
    await page.getByRole('button',{name:'Queue retry (duplicate risk)'}).click()
    await expect(page.getByText(/invitation: sent/)).toBeVisible()
    expect(db.prepare('SELECT status,attempts,idempotency_key FROM mail_deliveries WHERE id=?').get(before.id)).toEqual({status:'sent',attempts:2,idempotency_key:before.idempotency_key})
    expect(db.prepare('SELECT event FROM mail_delivery_attempts WHERE delivery_id=? ORDER BY created_at,rowid').all(before.id).map(row=>row.event)).toEqual(['started','unknown','operator-retry','started','sent'])
    expect(db.prepare("SELECT count(*) n FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=?").get(before.idempotency_key)?.n).toBe(1)
  } finally {db.exec('DROP TRIGGER IF EXISTS synthetic_mail_failure');db.close()}
})
