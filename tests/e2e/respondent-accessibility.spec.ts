import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import type { BuilderDraft, FlowStep } from '../../src/core/app/api'
import { responseScreens } from '../../src/core/shared/screenLayout'
import { contrastRatio } from '../../src/core/features/brand/brand'
import { questionTypes } from '../../src/core/shared/questionKinds'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

async function tabTo(page:Page,control:Locator) {
  for(let attempt=0;attempt<100;attempt++) {
    await page.keyboard.press('Tab')
    if(await control.evaluate(element=>element===document.activeElement))return
  }
  throw new Error('The answer control is not reachable with Tab.')
}
async function type(page:Page,control:Locator,value:string) {await tabTo(page,control);await page.keyboard.type(value)}
async function press(page:Page,control:Locator,key='Space') {await tabTo(page,control);await page.keyboard.press(key)}
async function answer(page:Page,step:FlowStep,region:Locator) {
  const name={name:step.prompt,exact:true}
  switch(step.questionType) {
    case 'short_text':case 'long_text':case 'email': await type(page,region.getByRole('textbox',name),step.questionType==='email'?'jo@example.com':'Excellent service');break
    case 'single_choice': await press(page,region.getByRole('radio',{name:'Online',exact:true}));break
    case 'multiple_choice': await press(page,region.getByRole('option',{name:'Online',exact:true}));break
    case 'priority':for(const label of ['Online','In person'])await press(page,region.getByRole('checkbox',{name:label,exact:true}));break
    case 'dropdown':await type(page,region.getByRole('searchbox'),'on');await press(page,region.getByRole('combobox',name),'ArrowDown');break
    case 'rating':await press(page,region.getByRole('radio',{name:/^0 out of/}));break
    case 'yes_no':await press(page,region.getByRole('radio',{name:'Yes',exact:true}));break
    case 'nps':await press(page,region.getByRole('radio',{name:'0',exact:true}));break
    case 'number':await type(page,region.getByRole('spinbutton',name),'12');break
    case 'date':for(const [part,value] of [['Month','07'],['Day','04'],['Year','2026']])await type(page,region.getByRole('textbox',{name:part,exact:true}),value);break
    case 'consent':await press(page,region.getByRole('checkbox',name));break
    case 'csat':case 'emoji_rating':await tabTo(page,region.getByRole('radio',{name:'1, Very dissatisfied',exact:true}));for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await expect(region.getByRole('radio',{name:'5, Very satisfied',exact:true})).toBeChecked();break
    case 'ces':await tabTo(page,region.getByRole('radio',{name:'1, Very difficult',exact:true}));await page.keyboard.press('End');await page.keyboard.press('Space');await expect(region.getByRole('radio',{name:'7, Very easy',exact:true})).toBeChecked();break
    case 'thumbs_rating':await tabTo(page,region.getByRole('radio',{name:'Thumbs down',exact:true}));await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await expect(region.getByRole('radio',{name:'Thumbs up',exact:true})).toBeChecked();break
    case 'phone':await type(page,region.getByRole('textbox',{name:'Phone number',exact:true}),'2025550147');await type(page,region.getByRole('textbox',{name:'Extension (optional)',exact:true}),'42');break
    case 'postal_address':for(const [label,value] of [['Street address','120 Main Street'],['City','Seattle'],['State or territory','WA'],['ZIP code','98101']])await type(page,region.getByRole('textbox',{name:label,exact:true}),value);break
    case 'full_name':for(const [label,value] of [['Given name','Jo'],['Family name','West']])await type(page,region.getByRole('textbox',{name:label,exact:true}),value);break
    case 'url':await type(page,region.getByRole('textbox',{name:'Website URL',exact:true}),'https://example.com');break
    case 'currency':await type(page,region.getByRole('textbox',{name:'Amount in USD',exact:true}),'125.50');break
  }
}
contract('A11Y-001','completes every shipped type across standalone, classic and grouped screens with keyboard, associated errors, focus, contrast and 320px reflow',async({page},info)=>{
  test.setTimeout(180_000);page.setDefaultTimeout(15_000)
  await signInEmptyWorkspace(page)
  const call=async<T,>(path:string,data?:unknown,method?:string):Promise<T>=>{
    const response=await page.request.fetch(path,{method:method??(data===undefined?'GET':'POST'),...(data===undefined?{}:{data})})
    expect(response.status(),await response.text()).toBeLessThan(300);return response.status()===204?undefined as T:response.json() as Promise<T>
  }
  await call('/api/app/brand',{name:'Westside services',supportingLine:'Help us plan your next visit.',accent:'#215b46',publicFlowSlug:null},'PUT')
  const slug=`accessibility-${info.project.name}-${Date.now()}`,{id}=await call<{id:string}>('/api/app/flows',{title:'Plan your next visit',slug})
  const base=`/api/app/flows/${id}`,read=()=>call<BuilderDraft>(`${base}/draft`)
  await call(`${base}/draft/steps`,{expectedVersion:(await read()).flow.draftVersion,step:{kind:'welcome',questionType:null,prompt:'Plan your next visit',helperText:'Tell us what works for you.'}})
  const prompts:Record<typeof questionTypes[number],string>={short_text:'What should we improve?',long_text:'Tell us about your visit',email:'Your work email',single_choice:'How will you attend?',multiple_choice:'Which services interest you?',rating:'How useful was your visit?',priority:'Rank your preferred channels',dropdown:'Preferred appointment channel',yes_no:'Would you visit again?',nps:'Would you recommend us?',number:'How many people will attend?',date:'Preferred visit date',consent:'Accept the visit terms',csat:'How satisfied are you?',ces:'How easy was it to get help?',emoji_rating:'How did your visit feel?',thumbs_rating:'Was this helpful?',phone:'Your phone number',postal_address:'Your mailing address',full_name:'Your name',url:'Your website',currency:'Your budget in USD'}
  for(const questionType of questionTypes) {
    const settings=questionType==='rating'?{min:0,max:10,lowLabel:'Not at all',middleLabel:'Neutral',highLabel:'Completely'}:questionType==='consent'?{statement:'I agree to the visit terms.'}:questionType==='short_text'?{maxLength:30}:{}
    await call(`${base}/draft/steps`,{expectedVersion:(await read()).flow.draftVersion,step:{kind:'question',questionType,prompt:prompts[questionType],required:true,questionSettings:settings,...(['single_choice','multiple_choice','priority','dropdown'].includes(questionType)?{choices:[{label:'Online',value:'online'},{label:'In person',value:'in-person'}]}:{})}})
  }
  await call(`${base}/draft/steps`,{expectedVersion:(await read()).flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'Your visit preferences are saved'}})
  const questions=(await read()).steps.filter(step=>step.kind==='question')
  for(const [kind,title,members] of [['group','About your visit',questions.slice(0,3)],['page','Your preferences',questions.slice(3,7)]] as const)await call(`${base}/draft/screen`,{expectedVersion:(await read()).flow.draftVersion,stepId:members[0].id,layout:{kind,title,questionIds:members.map(step=>step.id)}},'PUT')
  const draft=await read(),screens=responseScreens(draft.steps,draft.steps)
  await call(`${base}/publish`,{expectedVersion:draft.flow.draftVersion})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto(`/f/${slug}`)
  await expect(page.locator('main[data-hydrated=true]')).toBeVisible()
  const check=async()=>{
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    const viewport=page.viewportSize()!
    await page.setViewportSize({...viewport,width:320})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.setViewportSize(viewport)
  }
  await expect(page.getByRole('heading',{name:'Plan your next visit',exact:true})).toBeFocused()
  await check()
  const primary=()=>page.locator('.respondent-actions .primary-button')
  await press(page,page.getByRole('button',{name:'Save and finish later',exact:true}),'Enter')
  await check()
  await press(page,page.getByRole('button',{name:'Keep answering',exact:true}),'Enter')
  await press(page,primary(),'Enter')
  for(const screen of screens.filter(screen=>screen.steps[0].kind==='question')) {
    const title=screen.layout?.title??screen.steps[0].prompt
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeFocused()
    await press(page,primary(),'Enter')
    const errors=page.locator('fieldset[aria-invalid=true]')
    await expect(errors).toHaveCount(screen.steps.length)
    for(const field of await errors.all()) {
      const errorId=await field.getAttribute('aria-describedby')
      expect(errorId).toBeTruthy()
      await expect(page.locator(`[id="${errorId}"]`)).toBeVisible()
      const controls=field.locator('[aria-invalid=true][aria-describedby]')
      expect(await controls.count()).toBeGreaterThan(0)
      for(const control of await controls.all()) expect((await control.getAttribute('aria-describedby'))?.split(' ')).toContain(errorId)
    }
    expect(await page.locator('fieldset[aria-invalid=true]').first().evaluate(field=>field.contains(document.activeElement))).toBe(true)
    await check()
    await page.screenshot({path:`test-results/${info.project.name}-accessible-error-${screen.steps[0].questionType}.png`,fullPage:true})
    for(const step of screen.steps) {
      const region=screen.layout?page.getByRole('region',{name:step.prompt,exact:true}):page.locator('article.respondent-card')
      await answer(page,step,region)
    }
    await check()
    await page.screenshot({path:`test-results/${info.project.name}-accessible-${screen.layout?.kind??screen.steps[0].questionType}.png`,fullPage:true})
    const style=await primary().evaluate(element=>{const css=getComputedStyle(element);return {color:css.color,background:css.backgroundColor,transition:parseFloat(css.transitionDuration)}})
    expect(style.transition).toBeLessThan(0.01)
    const hex=(color:string)=>'#'+color.match(/\d+/g)!.slice(0,3).map(value=>Number(value).toString(16).padStart(2,'0')).join('')
    expect(contrastRatio(hex(style.color),hex(style.background))).toBeGreaterThanOrEqual(4.5)
    expect(await page.getByRole('progressbar',{name:'Response progress'}).getAttribute('aria-valuenow')).not.toBeNull()
    await press(page,primary(),'Enter')
  }
  await expect(page.getByRole('heading',{name:'Your visit preferences are saved',exact:true})).toBeFocused()
  await check();await page.screenshot({path:`test-results/${info.project.name}-accessible-completion.png`,fullPage:true})
  expect((await call<{total:number}>(`${base}/ledger`)).total).toBe(1)
  await call(`${base}/close`,{})
  await page.goto(`/f/${slug}`)
  await expect(page.getByRole('heading',{name:'This feedback flow is closed.',exact:true})).toBeFocused()
  await check();await page.screenshot({path:`test-results/${info.project.name}-accessible-closed.png`,fullPage:true})
  await page.goto(`/f/${slug}?resume=${'a'.repeat(64)}`)
  await expect(page.getByRole('heading',{name:'This resume link is no longer available.',exact:true})).toBeFocused()
  await check();await page.screenshot({path:`test-results/${info.project.name}-accessible-unavailable.png`,fullPage:true})
})
