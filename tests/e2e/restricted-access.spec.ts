import { generateKeyPairSync, sign } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect } from './fixtures'
import { contract } from './contract'
import { signInEmptyWorkspace } from './authoring-helpers'
import { testDevKey } from '../helpers/dev-key.mjs'

contract('DIST-019','build password, verified-email and app-signed forms, with server-first gating and one completion per verified email',async({page},info)=>{
  info.setTimeout(90000)
  await signInEmptyWorkspace(page)
  await page.getByRole('button',{name:'Customer feedback',exact:true}).click();await page.getByRole('button',{name:'Create draft flow'}).click()
  await expect(page.getByRole('heading',{name:'Customer feedback',exact:true})).toBeVisible()
  const builder=page.url(),flowId=/flows\/([^/]+)\//.exec(builder)![1]
  const options=page.locator('details').filter({has:page.getByText('Form access',{exact:true})})
  const openSettings=async()=>{await page.getByRole('button',{name:'Share',exact:true}).click();await options.getByText('Form access',{exact:true}).click();await expect(page.getByLabel('Access requirement')).toBeEnabled()}
  await openSettings()
  await page.getByLabel('Access requirement').selectOption('password');await page.getByLabel('New form password').fill('Aurora-team-access-2026')
  await page.getByRole('button',{name:'Save form access',exact:true}).click()
  await expect(page.getByText('Access saved to the draft. Publish to apply it to new respondents.',{exact:true})).toBeVisible()
  await options.screenshot({path:`test-results/${info.project.name}-access-password-settings.png`})
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  const publicUrl=await page.getByRole('region',{name:'Share this flow'}).getByLabel('Public link',{exact:true}).inputValue()
  await page.goto(publicUrl)
  await expect(page.getByLabel('Form password')).toBeVisible()
  expect(await page.content()).not.toContain('How was your experience?')
  expect(await page.getByRole('radio').count()).toBe(0)
  await page.getByLabel('Form password').fill('incorrect');await page.getByRole('button',{name:'Open form',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('invalid')
  await page.screenshot({path:`test-results/${info.project.name}-access-password-denied.png`})
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
  await page.getByLabel('Form password').fill('Aurora-team-access-2026');await page.getByRole('button',{name:'Open form',exact:true}).click()
  const complete=async(text:string,kiosk=false)=>{await expect(page.locator('.respondent-shell[data-hydrated=true]')).toBeVisible();await page.getByRole('radio',{name:'Good',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('textbox').fill(text);await page.waitForTimeout(3200);await page.getByRole('button',{name:'Submit response',exact:true}).click();await expect(page.getByRole('heading',{name:kiosk?'Thank you for your response.':'Thank you. Your response has been received.'})).toBeVisible()}
  await complete('The team would like an earlier workshop.')

  await page.goto(builder);await openSettings()
  await page.getByLabel('Access requirement').selectOption('email');await page.getByLabel('Allowed email domains').fill('aurora.example');await page.getByLabel('Allowed email addresses').fill('guest@example.com')
  await page.getByRole('button',{name:'Save form access',exact:true}).click();await expect(page.getByText('Access saved to the draft. Publish to apply it to new respondents.',{exact:true})).toBeVisible()
  await options.screenshot({path:`test-results/${info.project.name}-access-email-settings.png`})
  await page.getByRole('button',{name:'Publish',exact:true}).click();await expect(page.getByRole('region',{name:'Share this flow'})).toBeVisible()
  await page.goto(publicUrl+'?kiosk=10');await page.getByLabel('Your email',{exact:true}).fill('outsider@example.net');await page.getByRole('button',{name:'Send verification code',exact:true}).click();await expect(page.getByRole('alert')).toContainText('invalid')
  await page.getByLabel('Your email',{exact:true}).fill('Jo@Aurora.Example');await page.getByRole('button',{name:'Send verification code',exact:true}).click()
  await expect(page.getByLabel('Verification code',{exact:true})).toBeVisible()
  const mail=await page.request.get('/__test/mail',{headers:{'x-rer-dev-key':testDevKey}}).then(r=>r.json())
  const message=mail.messages.find((m:any)=>m.to.includes('jo@aurora.example')),code=/verification code is (\d{6})/.exec(message.text)![1]
  await page.screenshot({path:`test-results/${info.project.name}-access-email-code.png`})
  await page.getByLabel('Verification code',{exact:true}).fill(code);await page.getByRole('button',{name:'Open form',exact:true}).click()
  await expect(page.getByText(/identified as jo@aurora.example through verified form access/)).toBeVisible()
  await page.screenshot({path:`test-results/${info.project.name}-access-identified.png`})
  await complete('Keep the evening feedback sessions available.',true)
  await expect(page.getByLabel('Your email',{exact:true})).toBeVisible()
  await expect(page.getByLabel('Your email',{exact:true})).toHaveValue('')
  expect(await page.getByRole('radio').count()).toBe(0)
  await page.goto(publicUrl);await page.getByLabel('Your email',{exact:true}).fill('JO@AURORA.EXAMPLE');await page.getByRole('button',{name:'Send verification code',exact:true}).click();await expect(page.getByRole('alert')).toContainText('already completed')
  await page.screenshot({path:`test-results/${info.project.name}-access-repeat-refused.png`})

  const keys=generateKeyPairSync('ed25519'),publicKey=keys.publicKey.export({format:'jwk'}).x!
  await page.goto(builder);await openSettings();await page.getByLabel('Access requirement').selectOption('signed');await page.getByLabel('App signing public key').fill(publicKey)
  await page.getByRole('button',{name:'Save form access',exact:true}).click();await expect(page.getByText('Access saved to the draft. Publish to apply it to new respondents.',{exact:true})).toBeVisible();await options.screenshot({path:`test-results/${info.project.name}-access-app-settings.png`})
  await page.getByRole('button',{name:'Publish',exact:true}).click();await expect(page.getByRole('region',{name:'Share this flow'})).toBeVisible()
  const gated=await page.request.get(new URL(publicUrl).pathname.replace('/f/','/api/public/flows/')).then(r=>r.json())
  const encoded=Buffer.from(JSON.stringify({revisionId:gated.restriction.revisionId,expiresAt:Date.now()+600000,subject:'Aurora staff account'})).toString('base64url')
  const token=encoded+'.'+sign(null,Buffer.from(encoded),keys.privateKey).toString('base64url')
  await page.goto(publicUrl+'#access='+token)
  await expect(page.getByText('Your app link is ready to verify.',{exact:true})).toBeVisible()
  await page.screenshot({path:`test-results/${info.project.name}-access-app-gate.png`})
  await page.getByRole('button',{name:'Open form',exact:true}).click();await expect(page.getByText(/identified as Aurora staff account through verified form access/)).toBeVisible();await complete('Signed-in staff prefer a smaller workshop group.')
  await page.goto(`/app/flows/${flowId}/results`)
  await page.getByRole('button',{name:'View answers',exact:true}).first().click()
  await expect(page.getByText('Verified app account: Aurora staff account',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.locator('.ledger-row--open').screenshot({path:`test-results/${info.project.name}-access-ledger.png`})
})
