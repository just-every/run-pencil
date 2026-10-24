import { expect, test } from './fixtures'
import { contract } from './contract'
import { nativeHost, signInBrand } from './brand-helpers'
import type { BrowserContext, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

contract(['DIST-013', 'DIST-002', 'DIST-009', 'BASE-PUBLIC-001', 'BASE-PUBLIC-002'], 'copied async script mounts an opaque allowed-host iframe, resizes, emits only permitted events and rejects malicious messages', async ({ page, context, browser }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await signInBrand(page)
  const origin = process.env.PENCIL_E2E_BASE_URL!
  const workspace = await page.request.get('/api/app/workspace').then(r => r.json())
  const headers = { Origin: origin }
  const flow = await page.request.post('/api/app/flows', { headers, data: { title: 'Embedded feedback', slug: `embed-${crypto.randomUUID().slice(0, 8)}`, template: 'feedback' } }).then(r => r.json())
  let draft = await page.request.get(`/api/app/flows/${flow.id}/draft`).then(r => r.json())
  expect((await page.request.put(`/api/app/flows/${flow.id}/draft/settings`, { headers, data: { expectedVersion: draft.flow.draftVersion, settings: { identityMode: 'anonymous', hiddenFields: [{ id: 'synthetic-pencil-campaign', name: 'utm_campaign', type: 'text', category: 'campaign' }] } } })).status()).toBe(200)
  draft = await page.request.get(`/api/app/flows/${flow.id}/draft`).then(r => r.json())
  expect((await page.request.post(`/api/app/flows/${flow.id}/publish`, { headers, data: { expectedVersion: draft.flow.draftVersion } })).status()).toBe(201)
  await page.goto(`/app/flows/${flow.id}/builder`)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const snippet = await page.getByRole('textbox', { name: 'Script embed', exact: true }).inputValue()
  expect(snippet).toContain(`<script async src="${origin}/embed.js?flow=${flow.slug}"`)
  expect(snippet).not.toMatch(/token|response|answer|contact/i)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy script embed', exact: true }).click()
  await expect(page.getByText('Script embed copied.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(snippet)
  const iframeAlternative = await page.getByRole('textbox', { name: 'Embed code', exact: true }).inputValue()
  expect(iframeAlternative).toContain('sandbox="allow-scripts allow-forms"')
  const host = await nativeHost(snippet)
  let visitor: Page | undefined
  let visitorContext: BrowserContext | undefined
  try {
    expect((await page.request.put('/api/app/workspace', { headers, data: { ...workspace, embedAllowedOrigins: [host.origin] } })).status()).toBe(200)
    // A real host browser has no operator test headers or cookies. In particular,
    // custom identity headers would trigger preflights in the opaque child.
    visitorContext = await browser.newContext({ extraHTTPHeaders: {} })
    const checkoutAttempts:string[]=[]
    await visitorContext.route('https://checkout.stripe.com/**',route=>{
      checkoutAttempts.push(route.request().url())
      return route.abort('aborted')
    })
    visitor = await visitorContext.newPage()
    await visitor.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
    // The browser supplies public API Origin=null from the opaque child.
    const errors: string[] = [], requested: string[] = []
    visitor.on('pageerror', error => errors.push(error.message))
    visitor.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    visitor.on('request', request => requested.push(new URL(request.url()).origin))
    await visitor.goto(host.origin)
    const iframe = visitor.locator('iframe')
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-forms allow-top-navigation-by-user-activation')
    const frame = visitor.frameLocator('iframe')
    await expect(frame.getByRole('radio', { name: 'Great', exact: true })).toBeVisible()
    await expect.poll(() => visitor!.evaluate(() => (window as unknown as { events: { type: string }[] }).events.some(e => e.type === 'pencil:loaded'))).toBe(true)
    expect(await visitor.evaluate(() => document.querySelector('iframe')!.contentDocument)).toBeNull()
    expect(await visitor.evaluate(() => { try { void document.querySelector('iframe')!.contentWindow!.document.body; return false } catch { return true } })).toBe(true)
    const child = visitor.frames().find(f => f.url().includes('/embed/'))!
    const assertHeight = async () => {
      const actual = await child.locator('main').evaluate(el => Math.ceil(el.getBoundingClientRect().height))
      await expect.poll(() => iframe.evaluate(el => parseInt((el as HTMLIFrameElement).style.height))).toBe(actual)
      expect(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
      expect(await visitor!.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect((await new AxeBuilder({ page: visitor! }).analyze()).violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
      return actual
    }
    const firstHeight = await assertHeight()
    await child.evaluate(()=>{
      const observed=window as unknown as {acknowledgements:unknown[]}
      observed.acknowledgements=[]
      addEventListener('message',event=>observed.acknowledgements.push(event.data))
      parent.postMessage({type:'pencil:loaded',challenge:new URLSearchParams(location.hash.slice(1)).get('pencil-embed')},'*')
    })
    await expect.poll(()=>child.evaluate(()=>(window as unknown as {acknowledgements:{type:string}[]}).acknowledgements.some(message=>message.type==='pencil:loaded'))).toBe(true)
    const acknowledgements=await child.evaluate(()=>(window as unknown as {acknowledgements:unknown[]}).acknowledgements)
    expect(acknowledgements).toEqual([{type:'pencil:loaded',challenge:new URLSearchParams(new URL((await iframe.getAttribute('src'))!).hash.slice(1)).get('pencil-embed')}])
    expect(await visitor.evaluate(()=>(window as unknown as {events:{type:string}[]}).events.filter(event=>event.type==='pencil:loaded'))).toHaveLength(1)
    if(process.env.PENCIL_CAPTURE_DIR) {
      await mkdir(process.env.PENCIL_CAPTURE_DIR,{recursive:true})
      await visitor.screenshot({path:join(process.env.PENCIL_CAPTURE_DIR,`${info.project.name}-script-embed-public.png`),fullPage:true})
    }
    const before = await visitor.evaluate(() => JSON.stringify((window as unknown as { events: unknown[] }).events))
    await visitor.evaluate(() => {
      const frame = document.querySelector('iframe')!
      const challenge = new URLSearchParams(new URL(frame.src).hash.slice(1)).get('pencil-embed')!
      window.postMessage({ type: 'pencil:height', challenge, height: 1 }, '*')
      window.postMessage({ type: 'pencil:checkout', challenge, url:'https://checkout.stripe.com/c/pay/synthetic-pencil-1',sessionId:'synthetic-pencil-1' }, '*')
      frame.contentWindow!.postMessage({ type: 'pencil:init', challenge, answers: 'must-be-refused' }, '*')
    })
    const barrier=crypto.randomUUID()
    await child.evaluate(barrier => {
      const challenge = new URLSearchParams(location.hash.slice(1)).get('pencil-embed')!
      for (const data of [{ type: 'pencil:completed', challenge, responseId: 'must-be-refused' }, { type: 'pencil:height', challenge, height: 1, answers: [] }, { type: 'pencil:height', challenge: '00'.repeat(16), height: 1 }, { type: 'pencil:height', challenge, height: -1 }]) parent.postMessage(data, '*')
      const checkout={type:'pencil:checkout',challenge,url:'https://checkout.stripe.com/c/pay/synthetic-pencil-2',sessionId:'synthetic-pencil-2'}
      for(const url of ['http://checkout.stripe.com/c/pay/synthetic-pencil-3','https://checkout.stripe.com.hostile.invalid/pay','https://checkout.stripe.com@hostile.invalid/pay','https://private@checkout.stripe.com/pay','https://checkout.stripe.com:444/pay','https://checkout.stripe.com./pay','javascript:alert(1)'])parent.postMessage({...checkout,url},'*')
      for(const sessionId of ['', 'x'.repeat(1000), 'synthetic-pencil-4\ninvalid', 'synthetic-pencil-5😀', 7])parent.postMessage({...checkout,sessionId},'*')
      for(const data of [{type:'pencil:checkout',challenge,url:checkout.url},{...checkout,challenge:'00'.repeat(16)},{...checkout,responseId:'must-be-refused'},{...checkout,payment:{state:'pending'}},{...checkout,type:'pencil:loaded'}])parent.postMessage(data,'*')
      parent.postMessage({type:'test:message-barrier',barrier},'*')
    },barrier)
    await expect.poll(()=>visitor!.evaluate(barrier=>(window as unknown as {messages:{type?:string;barrier?:string}[]}).messages.some(message=>message.type==='test:message-barrier'&&message.barrier===barrier),barrier)).toBe(true)
    expect(await visitor.evaluate(() => JSON.stringify((window as unknown as { events: unknown[] }).events))).toBe(before)
    expect(checkoutAttempts).toEqual([])
    expect(visitor.url()).toBe(`${host.origin}/`)
    await frame.getByRole('radio', { name: 'Great', exact: true }).click()
    await frame.getByRole('button', { name: 'Continue', exact: true }).click()
    await frame.getByRole('textbox', { name: 'What could we do better?' }).fill('Private answer never sent to the host.')
    await assertHeight()
    await frame.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(frame.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
    const finalHeight = await assertHeight()
    if(process.env.PENCIL_CAPTURE_DIR)await visitor.screenshot({path:join(process.env.PENCIL_CAPTURE_DIR,`${info.project.name}-script-embed-completed.png`),fullPage:true})
    expect(finalHeight).not.toBe(firstHeight)
    await expect.poll(() => visitor!.evaluate(() => (window as unknown as { events: { type: string }[] }).events.filter(e => e.type === 'pencil:completed').length)).toBe(1)
    const hostDom = await visitor.locator('body').innerText()
    expect(hostDom).not.toContain('Private answer')
    expect(visitor.url()).toBe(`${host.origin}/`)
    expect(await iframe.getAttribute('src')).toMatch(new RegExp(`/embed/${flow.slug}#pencil-embed=[a-f0-9]{32}$`))
    expect(await visitor.evaluate(() => (window as unknown as { events: unknown[] }).events)).not.toEqual([])
    const permitted = await visitor.evaluate(() => (window as unknown as { events: { type: string; detail: unknown }[] }).events)
    for (const event of permitted) {
      expect(['pencil:loaded', 'pencil:height', 'pencil:completed']).toContain(event.type)
      if (event.type === 'pencil:height') {
        expect(Object.keys(event.detail as object)).toEqual(['height'])
        expect(Number.isInteger((event.detail as { height: number }).height)).toBe(true)
      } else expect(event.detail).toBeNull()
    }
    const events = await visitor.evaluate(() => JSON.stringify((window as unknown as { events: unknown[] }).events))
    expect(events).not.toMatch(/answer|responseId|token|contact|Private/)
    expect([...new Set(requested)].sort()).toEqual([host.origin, origin].sort())
    expect(errors).toEqual([])
    // The network edge cancels top-level navigation, keeping the real host alive
    // so a replay can be sent through the same postMessage listener.
    const checkout={url:'https://checkout.stripe.com/c/pay/synthetic-pencil-2',sessionId:'synthetic-pencil-2'}
    await child.evaluate(checkout=>{
      const challenge=new URLSearchParams(location.hash.slice(1)).get('pencil-embed')!
      parent.postMessage({type:'pencil:checkout',challenge,...checkout},'*')
    },checkout)
    await expect.poll(()=>checkoutAttempts.length).toBe(1)
    await expect.poll(()=>visitor!.evaluate(()=>(window as unknown as {events:{type:string}[]}).events.filter(event=>event.type==='pencil:checkout').length)).toBe(1)
    const replayBarrier=crypto.randomUUID()
    await child.evaluate(({checkout,barrier})=>{
      const challenge=new URLSearchParams(location.hash.slice(1)).get('pencil-embed')!
      for(const url of [checkout.url,checkout.url+'?replayed=1'])parent.postMessage({type:'pencil:checkout',challenge,url,sessionId:checkout.sessionId},'*')
      parent.postMessage({type:'test:message-barrier',barrier},'*')
    },{checkout,barrier:replayBarrier})
    await expect.poll(()=>visitor!.evaluate(barrier=>(window as unknown as {messages:{type?:string;barrier?:string}[]}).messages.some(message=>message.type==='test:message-barrier'&&message.barrier===barrier),replayBarrier)).toBe(true)
    expect(checkoutAttempts).toEqual([checkout.url])
    expect(await visitor.evaluate(()=>(window as unknown as {events:{type:string;detail:unknown}[]}).events.filter(event=>event.type==='pencil:checkout'))).toEqual([{type:'pencil:checkout',detail:checkout}])
    expect(visitor.url()).toBe(`${host.origin}/`)
    expect(await visitor.locator('body').innerText()).not.toContain('Private answer')
    let forwardedResponses = 0
    for (const [mode, trigger] of [['full-page','click'],['popup','delay'],['popover','scroll'],['slider','exit'],['side-tab','click']]) {
      const modalHost = await nativeHost(snippet.replace('<script ', `<script data-pencil-mode="${mode}" data-pencil-trigger="${trigger}" data-pencil-delay="0" data-pencil-scroll="25" `))
      const modal = await visitorContext.newPage()
      try {
        await modal.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
        await modal.context().newCDPSession(modal).then(session => session.send('Emulation.setCPUThrottlingRate', { rate: 4 }))
        expect((await page.request.put('/api/app/workspace', { headers, data: { ...workspace, embedAllowedOrigins: [host.origin, modalHost.origin] } })).status()).toBe(200)
        await modal.goto(modalHost.origin + '/landing?utm_campaign=spring')
        await expect(modal.getByRole('button', { name: 'Open form', exact: true })).toBeVisible()
        if (trigger === 'click') await modal.getByRole('button', { name: 'Open form', exact: true }).click()
        if (trigger === 'scroll') await modal.evaluate(() => { document.body.style.minHeight = '3000px'; scrollTo(0, 1500) })
        if (trigger === 'exit') await modal.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { clientY: -1, relatedTarget: null })))
        await expect(modal.getByRole('dialog', { name: 'Feedback form', exact: true })).toBeVisible()
        const embedded = modal.frameLocator('iframe')
        await expect(embedded.getByRole('radio', { name: 'Great', exact: true })).toBeVisible()
        await embedded.getByRole('radio', { name: 'Great', exact: true }).click()
        await embedded.getByRole('button', { name: 'Continue', exact: true }).click()
        await embedded.getByRole('textbox', { name: 'What could we do better?' }).fill('Private modal response')
        await embedded.getByRole('button', { name: 'Submit response', exact: true }).click()
        await expect(embedded.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
        await expect.poll(() => modal.evaluate(() => (window as unknown as { events: { type: string }[] }).events.some(event => event.type === 'pencil:completed'))).toBe(true)
        const modalEvents = await modal.evaluate(() => (window as unknown as { events: { type: string; detail: unknown }[] }).events)
        for (const event of modalEvents) expect(['pencil:loaded','pencil:height','pencil:completed']).toContain(event.type)
        expect(JSON.stringify(modalEvents)).not.toMatch(/answer|responseId|token|Private modal/)
        expect(await modal.locator('iframe').getAttribute('src')).toContain('utm_campaign=spring')
        const exported = await page.request.post('/api/app/backup/export', { headers, data: {} })
        expect(exported.status()).toBe(200)
        const archive = await exported.json()
        const responses = archive.payload.tables.find((table: any) => table.name === 'responses')
        const revisionColumn = responses.columns.indexOf('revision_id'), contextColumn = responses.columns.indexOf('response_context_json')
        const campaigns = responses.rows.filter((row: any[]) => row[revisionColumn].value === draft.revision.id && JSON.parse(row[contextColumn].value).hidden?.['synthetic-pencil-campaign'] === 'spring')
        expect(campaigns).toHaveLength(++forwardedResponses)
        expect(await modal.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await modal.screenshot({ path: info.outputPath(`${mode}-completed.png`), fullPage: true })
        await modal.getByRole('button', { name: 'Close form', exact: true }).click()
        await modal.getByRole('button', { name: 'Open form', exact: true }).click()
        await expect(modal.getByRole('dialog')).toBeHidden()
        await modal.reload()
        await modal.getByRole('button', { name: 'Open form', exact: true }).click()
        await expect(modal.locator('iframe')).toHaveCount(0)
      } finally { await modal.close(); await modalHost.close() }
    }
    for (const referer of ['https://hostile.invalid/page', `${host.origin}.hostile.invalid/page`, '']) {
      const refused = await page.request.get(`/embed.js?flow=${flow.slug}`, { headers: { Referer: referer } })
      expect(refused.status()).toBe(403)
      expect(await refused.text()).not.toContain('createElement')
      expect((await page.request.get(`/embed/${flow.slug}`, { headers: { Referer: referer, 'Sec-Fetch-Dest': 'iframe' } })).status()).toBe(403)
    }
  } finally {
    await visitor?.close(); await visitorContext?.close(); await host.close()
    await page.request.put('/api/app/workspace', { headers, data: workspace })
  }
})
