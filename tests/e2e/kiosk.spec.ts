import { readFile } from 'node:fs/promises'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { expect } from './fixtures'
import { contract } from './contract'
import { signInEmptyWorkspace } from './authoring-helpers'

contract(["DIST-012","DIST-023"],'download labelled QR codes and collect isolated shared-device responses with idle clearing',async({page},info)=>{
  info.setTimeout(120000)
  await signInEmptyWorkspace(page)
  await page.getByRole('button',{name:'Customer feedback',exact:true}).click()
  await page.getByRole('button',{name:'Create draft flow'}).click()
  await expect(page.getByRole('heading',{name:'Customer feedback',exact:true})).toBeVisible()
  const builder=page.url(),flowId=/flows\/([^/]+)\//.exec(builder)![1]
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  const share=page.getByRole('region',{name:'Share this flow'})
  const direct=await share.getByLabel('Public link',{exact:true}).inputValue()
  await page.getByText('Manage named collectors',{exact:true}).click()
  await page.getByLabel('Collector name',{exact:true}).fill('Aurora counter')
  await page.getByLabel('Collector channel',{exact:true}).selectOption('qr')
  await page.getByRole('button',{name:'Create collector',exact:true}).click()
  const collector=page.locator('.collector-card').filter({has:page.getByRole('heading',{name:'Aurora counter',exact:true})})
  const publicUrl=await collector.getByLabel('Aurora counter link',{exact:true}).inputValue()
  await share.getByText('QR and kiosk · Public link',{exact:true}).click()
  await collector.getByText('QR and kiosk · Aurora counter',{exact:true}).click()
  const sources=await (await page.request.get(`/api/app/flows/${flowId}/collectors`)).json()
  const defaultDirect=sources.find((row:any)=>row.systemSource==='direct')
  const defaultEmbed=sources.find((row:any)=>row.systemSource==='embed')
  await page.getByText('Default source collectors',{exact:true}).click()
  const defaults=page.getByRole('region',{name:'Named collectors'}).locator('details').filter({has:page.getByText('Default source collectors',{exact:true})})
  const cases=[{region:share,label:'Public link',target:direct,collectorId:defaultDirect.id},{region:collector,label:'Aurora counter',target:publicUrl,collectorId:sources.find((row:any)=>row.name==='Aurora counter').id}]
  for(const source of sources.filter((row:any)=>row.systemSource)){
    const row=defaults.locator('li').filter({hasText:`${source.name}:`})
    if(['direct','embed'].includes(source.systemSource)){
      expect(source.publicPath).toBeTruthy()
      await row.getByText(`QR and kiosk · ${source.name}`,{exact:true}).click()
      cases.push({region:row,label:source.name,target:new URL(source.publicPath,new URL(direct).origin).href,collectorId:source.id})
    }else{
      expect(source.publicPath).toBeNull()
      expect(await row.getByRole('link').count()).toBe(0)
      expect((await page.request.get(`/api/app/flows/${flowId}/collectors/${encodeURIComponent(source.id)}/qr?format=svg`)).status()).toBe(400)
    }
  }
  await defaults.screenshot({path:`test-results/${info.project.name}-qr-default-sources.png`})
  const expectedCounts:Record<string,number>={}
  for(const {region,label,target,collectorId} of cases){
    for(const format of ['SVG','PNG']){
      const waiting=page.waitForEvent('download')
      await region.getByRole('link',{name:`Download ${label} QR (${format})`,exact:true}).click()
      const download=await waiting,bytes=await readFile((await download.path())!)
      expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`))
      expect(bytes.toString(format==='SVG'?'utf8':'latin1')).toContain(label==='Public link'?'Direct link':label)
      let raster:Buffer
      if(format==='PNG')raster=bytes
      else {
        const data=await page.evaluate(async svg=>{
          const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));await img.decode()
          const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d')!.drawImage(img,0,0);return canvas.toDataURL('image/png').split(',')[1]
        },bytes.toString('utf8'))
        raster=Buffer.from(data,'base64')
      }
      const png=PNG.sync.read(raster)
      const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data
      expect(decoded).toBe(target)
      // A QR scan is a fresh public browser, without the operator context's Origin or cookies.
      const visitContext=await page.context().browser()!.newContext({viewport:page.viewportSize()!})
      const visit=await visitContext.newPage()
      try{
        await visit.goto(decoded!)
        const respondent=visit
        await expect(respondent.locator('.respondent-shell[data-hydrated=true]')).toBeVisible()
        await respondent.getByRole('radio',{name:'Good',exact:true}).click()
        await respondent.getByRole('button',{name:'Continue',exact:true}).click()
        await respondent.getByRole('textbox').fill(`Collected by scanning ${label} ${format}.`)
        await visit.waitForTimeout(3200)
        await respondent.getByRole('button',{name:'Submit response',exact:true}).click()
        await expect(respondent.getByRole('heading',{name:'Thank you. Your response has been received.'})).toBeVisible()
        expectedCounts[collectorId]=(expectedCounts[collectorId]??0)+1
      }finally{await visitContext.close()}
    }
  }
  await share.scrollIntoViewIfNeeded();await share.screenshot({path:`test-results/${info.project.name}-qr-share.png`})
  await collector.getByText('Kiosk for Aurora counter',{exact:true}).click()
  await collector.getByLabel('Clear idle answers after').selectOption('10')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await collector.screenshot({path:`test-results/${info.project.name}-qr-collector.png`})
  const kioskUrl=await collector.getByRole('link',{name:'Open Aurora counter kiosk',exact:true}).getAttribute('href')
  await page.goto(kioskUrl!)
  const fill=async(choice:string,text:string)=>{
    await expect(page.locator('.respondent-shell[data-hydrated=true]')).toBeVisible()
    await page.getByRole('radio',{name:choice,exact:true}).click()
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('textbox').fill(text)
    await page.waitForTimeout(3200)
  }
  await fill('Good','The first customer asked for oat milk.')
  await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Thank you for your response.'})).toBeVisible()
  await page.screenshot({path:`test-results/${info.project.name}-kiosk-complete.png`})
  await expect(page.getByRole('radio',{name:'Good',exact:true})).toBeVisible()
  await expect(page.getByRole('radio',{name:'Good',exact:true})).not.toBeChecked()
  await page.getByRole('radio',{name:'Good',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click()
  await expect(page.getByRole('textbox')).toHaveValue('')
  await page.getByRole('textbox').fill('A second customer would like a later closing time.')
  await page.screenshot({path:`test-results/${info.project.name}-kiosk-answer.png`})
  await page.waitForTimeout(3200);await page.getByRole('button',{name:'Submit response',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Thank you for your response.'})).toBeVisible()
  await expect(page.getByRole('radio',{name:'Good',exact:true})).toBeVisible()
  await page.getByRole('radio',{name:'Good',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click()
  await page.getByRole('textbox').fill('Private abandoned answer')
  await expect(page.getByRole('radio',{name:'Good',exact:true})).toBeVisible({timeout:15000})
  await expect(page.getByRole('radio',{name:'Good',exact:true})).not.toBeChecked()
  await page.getByRole('radio',{name:'Good',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('textbox')).toHaveValue('')
  await page.screenshot({path:`test-results/${info.project.name}-kiosk-idle-cleared.png`})
  await page.goto(builder)
  const ledger=await (await page.request.get(`/api/app/flows/${flowId}/ledger`)).json()
  expectedCounts[sources.find((row:any)=>row.name==='Aurora counter').id]+=2
  expect(ledger.total).toBe(Object.values(expectedCounts).reduce((sum,count)=>sum+count,0))
  for(const [id,count] of Object.entries(expectedCounts))expect(ledger.responses.filter((row:any)=>row.collector.id===id)).toHaveLength(count)
  const after=await (await page.request.get(`/api/app/flows/${flowId}/collectors`)).json()
  for(const source of after.filter((row:any)=>['invitation','imported','unknown'].includes(row.systemSource))){expect(source.publicPath).toBeNull();expect(source.released).toBe(0)}
  expect(JSON.stringify(ledger)).not.toContain('Private abandoned answer')
})
