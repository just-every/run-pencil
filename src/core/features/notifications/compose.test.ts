import { expect } from 'vitest'
import { png } from './brand-mail-fixture'
import { contract } from '../../../test/contract'
import { buttonTextColor, composeResponseNotification, notificationSenderError } from './compose'
const input={businessName:'Business',flowTitle:'Feedback',submittedAt:'2026-10-08T00:00:00Z',timeZone:'Australia/Brisbane',resultsUrl:'https://forms.example.test/app/flows/flow/results',accentColor:'#245c46'}
contract(['NOTIFY-002','NOTIFY-004'],'notification text and HTML escape hostile names and titles without header injection, tracking or answer fields',()=>{
  const hostile=`<script>alert("x")</script> & 'quoted' עברית\r\nBcc: hidden@example.test ${'long '.repeat(250)}`
  const message=composeResponseNotification({...input,businessName:hostile,flowTitle:hostile})
  expect(message.text).toContain(hostile)
  expect(message.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39; עברית')
  expect(message.html).not.toMatch(/<script|<img[^>]+src=["\'](?!cid:)|<iframe|<link|@font|tracking/i)
  expect(message.subject).not.toMatch(/[\r\n]/)
  expect(message.text).toContain('Australia/Brisbane')
  expect(message.text).toContain('10:00:00')
  expect(message.html).toContain(input.resultsUrl)
  expect(message.headers).toEqual({'Auto-Submitted':'auto-generated'})
  expect(message).not.toHaveProperty('answers')
  const inline=composeResponseNotification({...input,logo:{content:png,contentType:'image/png'}})
  expect(inline.html.match(/<img\b/g)).toHaveLength(1)
  expect(inline.attachments).toHaveLength(1)
  expect(inline.html).toContain(`src="cid:${inline.attachments![0].contentId}"`)
  expect(inline.attachments![0]).toMatchObject({content:png,contentType:'image/png',disposition:'inline'})
  expect(message.html).not.toContain('<img')
  expect(message.attachments).toBeUndefined()
  for(const resultsUrl of ['javascript:alert(1)','https://forms.example.test/app/flows/a/results?token=secret','https://forms.example.test/i/capability']) expect(()=>composeResponseNotification({...input,resultsUrl})).toThrow()
})
contract(['NOTIFY-002'],'button text meets contrast for light, dark and middle accents',()=>{
  for(let n=0;n<=255;n++) {
    const accent='#'+n.toString(16).padStart(2,'0').repeat(3),text=buttonTextColor(accent),v=n/255,l=v<=.04045?v/12.92:((v+.055)/1.055)**2.4
    expect(text==='#000000'?(l+.05)/.05:1.05/(l+.05)).toBeGreaterThanOrEqual(4.5)
  }
  expect(()=>buttonTextColor('red;background:url(x)')).toThrow()
})
contract(['NOTIFY-004'],'notification sender accepts only a plain configured no-reply address and names its failure',()=>{
  for(const address of ['noreply@example.test','no-reply@example.test']) expect(notificationSenderError(address)).toBeNull()
  for(const address of ['owner@example.test','Display <noreply@example.test>','noreply@example.test\r\nBcc: injected@example.test']) expect(notificationSenderError(address)).toContain('MAIL_FROM')
})
contract(['NOTIFY-004'],'only genuine pre-transport Base configuration errors disable notification mail; unsafe provider diagnostics are never retained',async()=>{
  const {notificationConfigurationFailure,safeNotificationReceipt}=await import('./failure')
  const {baseMailSender}=await import('../../platform/mail/base.server')
  let failure:unknown
  try{baseMailSender({kind:'sendgrid',apiKey:'synthetic invalid key',from:'no-reply@example.test'},{} as D1Database)}catch(error){failure=error}
  expect(notificationConfigurationFailure(failure)).toContain('MAIL_API_KEY')
  expect(notificationConfigurationFailure(new Error('synthetic secret'))).toBeNull()
  expect(safeNotificationReceipt('sendgrid','provider_rejected')).toEqual({provider:'sendgrid',code:'provider_rejected'})
  expect(safeNotificationReceipt('unsafe-provider-secret','private provider body')).toEqual({provider:null,code:null})
})
