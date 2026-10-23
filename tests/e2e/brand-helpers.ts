import { createServer } from 'node:http'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect } from './fixtures'
import { operatorEmail } from './auth-identity'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
export const logo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=', 'base64')
export async function signInBrand(page: Page) {
  const origin = process.env.PENCIL_E2E_BASE_URL!
  const email = operatorEmail()
  expect((await page.request.post('/auth/magic-link', { headers: { Origin: origin }, data: { email } })).status()).toBe(202)
  const inbox = await developmentInbox(path => page.request.get(path, { headers: devKeyHeaders }), email)
  expect(inbox.messages).toHaveLength(1)
  expect(inbox.messages[0].magicLinkToken).toBeTruthy()
  expect((await page.request.post('/auth/confirm', { headers: { Origin: origin }, data: { token: inbox.messages[0].magicLinkToken }, maxRedirects: 0 })).status()).toBe(303)
  expect((await page.request.get('/api/app/brand')).status()).toBe(200)
}
export async function checkBrand(page: Page, accent = 'rgb(117, 117, 117)', withLogo = true) {
  const surface = page.locator('.brand-surface').first()
  await expect(surface.locator('.brand-identity')).toContainText('North Studio')
  await expect(surface.locator('.brand-identity')).toContainText('Tell us what would help.')
  const image = surface.getByRole('img', { name: 'North Studio logo' })
  if (withLogo) {
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    expect(await image.evaluate((img: HTMLImageElement) => new URL(img.currentSrc).origin)).toBe(new URL(process.env.PENCIL_E2E_BASE_URL!).origin)
  } else await expect(image).toHaveCount(0)
  expect(await surface.evaluate(el => getComputedStyle(el).getPropertyValue('--brand-accent').trim())).toBe('#757575')
  if (await surface.locator('.primary-button').count()) await expect.poll(() => surface.locator('.primary-button').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe(accent)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
}
export async function nativeHost(snippet: string) {
  const server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html', 'Referrer-Policy': 'origin' }); response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Business website</title></head><body style="margin:0"><main><h1>Customer feedback</h1><script>window.events=[];window.messages=[];for(const type of ['pencil:loaded','pencil:height','pencil:completed','pencil:checkout'])document.addEventListener(type,event=>window.events.push({type:event.type,detail:event.detail}));addEventListener('message',event=>window.messages.push(event.data));</script>${snippet}</main></body></html>`) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  return { origin: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

export async function browserLogo(page: Page, mime = 'image/png') {
  const encoded = await page.evaluate(type => {
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 48
    const drawing = canvas.getContext('2d')!; drawing.fillStyle = '#ffffff'; drawing.fillRect(0, 0, 180, 48)
    drawing.fillStyle = '#11131d'; drawing.font = 'bold 20px sans-serif'; drawing.fillText('North Studio', 12, 32)
    return canvas.toDataURL(type).split(',')[1]
  }, mime)
  return Buffer.from(encoded, 'base64')
}

// A missing stored selection can arise after data recovery; the settings API
// correctly refuses creating it. Exercise that durable state in scratch D1.
export function missingLandingSelection() {
  const directory = process.env.PENCIL_MIGRATION_STATE!
  const file = readdirSync(directory).find(name => name.endsWith('.sqlite'))!
  const database = new DatabaseSync(join(directory, file))
  try {
    database.exec('PRAGMA busy_timeout = 1000')
    database.prepare('UPDATE workspaces SET public_flow_slug = ?').run(`missing-${crypto.randomUUID()}`)
  } finally { database.close() }
}

/** Observe the real send call. Cross-origin WindowProxy calls bypass a parent's JavaScript method override. */
export async function observeEmbedMessages(context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page, receive: (message: {payload:unknown;targetOrigin:string})=>void) {
  const parentSession = await context.newCDPSession(page)
  const child=page.frames().find(frame=>frame.url().includes('/embed/'))!
  const {targetInfos}=await parentSession.send('Target.getTargets')
  const separate=targetInfos.some(target=>target.type==='iframe'&&target.url===child.url())
  const session=separate?await context.newCDPSession(child):parentSession
  if(separate)await parentSession.detach()
  if(process.env.PENCIL_PROOF_CPU_RATE==='4')await session.send('Emulation.setCPUThrottlingRate',{rate:4})
  const scripts: Array<{scriptId:string;url:string}> = [], errors:string[]=[]
  const expressions = new Map<string,string>()
  session.on('Debugger.scriptParsed',script=>scripts.push(script))
  session.on('Debugger.paused',event=>{
    void (async()=>{
      try {
        const expression=event.hitBreakpoints?.map(id=>expressions.get(id)).find(Boolean)
        if(expression) {
          const result=await session.send('Debugger.evaluateOnCallFrame',{callFrameId:event.callFrames[0].callFrameId,expression,returnByValue:true})
          if(result.exceptionDetails) throw new Error('The embed send arguments could not be observed.')
          const value=result.result.value as {payload:{type?:string};targetOrigin:string}
          if(value.payload?.type==='pencil:checkout')receive(value)
        }
      } finally { await session.send('Debugger.resume') }
    })().catch(error=>errors.push(String(error)))
  })
  await session.send('Debugger.enable')
  await session.send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true})
  await expect.poll(()=>scripts.filter(script=>script.url.includes('/assets/')).length).toBeGreaterThan(0)
  let installed=0
  for(const script of scripts.filter(script=>script.url.includes('/assets/'))) {
    const {scriptSource}=await session.send('Debugger.getScriptSource',{scriptId:script.scriptId})
    for(const match of scriptSource.matchAll(/window\.parent\.postMessage\(([^,;]+),\s*([^);]+)\)/g)) {
      const before=scriptSource.slice(0,match.index), lines=before.split('\n')
      const {breakpointId}=await session.send('Debugger.setBreakpoint',{location:{scriptId:script.scriptId,lineNumber:lines.length-1,columnNumber:lines.at(-1)!.length}})
      expressions.set(breakpointId,`({payload:(${match[1]}),targetOrigin:(${match[2]})})`)
      installed++
    }
  }
  expect(installed,'a real embed send call is observable').toBeGreaterThan(0)
  return errors
}
