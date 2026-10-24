import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { surveyMonkeyDetails,surveyMonkeyResponses } from '../fixtures/form-import/surveymonkey'
contract('IMPORT-005','SurveyMonkey file-pair upload reviews every supported field and names the omitted elements',async({page},info)=>{
 const cdp=await page.context().newCDPSession(page)
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
 await signInEmptyWorkspace(page)
 await page.getByRole('link',{name:'Import a form',exact:true}).click()
 await page.getByRole('combobox',{name:'Source',exact:true}).selectOption('surveymonkey')
 await expect(page.getByText(/Upload the API v3 survey-details JSON/)).toBeVisible()
 await page.getByLabel('Form definition JSON',{exact:true}).setInputFiles({name:'survey-details.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(surveyMonkeyDetails))})
 await page.getByLabel('Responses-bulk JSON (required)',{exact:true}).setInputFiles({name:'responses-bulk.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(surveyMonkeyResponses))})
 const check=async(name:string)=>{await page.screenshot({path:info.outputPath(`${info.project.name}-${name}.png`),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])}
 await check('surveymonkey-upload')
 await page.getByRole('button',{name:'Review import',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Review the mapping',exact:true})).toBeVisible()
 await expect(page.getByText(/3 questions · 1 valid response rows/)).toBeVisible()
 const report=page.getByRole('list',{name:'Field and logic mapping report'})
 await expect(report).toContainText('Unsupported matrix')
 await expect(report).toContainText('Later descriptive text')
 await expect(report).toContainText('Other write-in')
 await expect(report).toContainText('Source collector synthetic-pencil-201')
 await expect(page.getByRole('button',{name:'Import reviewed form',exact:true})).toBeDisabled()
 await check('surveymonkey-review')
 expect(await (await page.request.get('/api/app/imports')).json()).toEqual([])
})
