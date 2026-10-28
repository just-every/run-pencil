import AxeBuilder from '@axe-core/playwright'
import type { BuilderDraft } from '../../src/core/app/api'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

contract(["LOGIC-006","LOGIC-008","LOGIC-009"], 'builds nested lead conditions, inspects their values and collects both published paths', async ({ page }, info) => {
  test.setTimeout(90_000)
  await signInEmptyWorkspace(page)
  const slug = `business-leads-${info.project.name}-${Date.now()}`
  const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
    const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const flow = await call<{id:string}>('/api/app/flows', 'POST', {title: 'Business consultation requests', slug})
  const base = `/api/app/flows/${flow.id}`
  const read = () => call<BuilderDraft>(`${base}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'number', prompt: 'Company size', required: true },
    { kind: 'question', questionType: 'single_choice', prompt: 'Your role', required: true, choices: ['Decision maker','Partner','Other'].map(label => ({label,value:label})) },
    { kind: 'question', questionType: 'long_text', prompt: 'How can we help?', required: false },
    { kind: 'completion', questionType: null, prompt: 'Book a consultation' },
    { kind: 'completion', questionType: null, prompt: 'We will send you our guide' },
  ]) await call(`${base}/draft/steps`, 'POST', {expectedVersion:(await read()).flow.draftVersion,step})
  const draft = await read(), [size, role, message, qualified, ordinary] = draft.steps
  await call(`${base}/draft`, 'PUT', {expectedVersion:draft.flow.draftVersion,stepId:message.id,prompt:message.prompt,required:false,nextStepId:ordinary.id})
  await page.goto(`/app/flows/${flow.id}/builder`)
  await page.getByRole('complementary', {name:'Flow steps'}).getByRole('button', {name:/How can we help/}).click()
  const editor = page.getByRole('complementary', {name:'Step settings'})
  await editor.getByRole('button', {name:'Answer paths',exact:true}).click()
  await editor.getByRole('button', {name:'Add condition rule',exact:true}).click()
  const rule = editor.getByRole('group', {name:'Rule 1',exact:true})
  const root = rule.getByRole('group', {name:'Condition group',exact:true}).first()
  await root.getByLabel('Match',{exact:true}).selectOption('or')
  await root.getByLabel('Question',{exact:true}).selectOption(role.id)
  await root.getByLabel('Answer',{exact:true}).selectOption(draft.choices.find(choice=>choice.label==='Partner')!.id)
  await root.getByRole('button', {name:'Add group',exact:true}).click()
  const nested = root.getByRole('group', {name:'Condition group',exact:true})
  await nested.getByLabel('Match',{exact:true}).selectOption('and')
  await nested.getByLabel('Question',{exact:true}).selectOption(size.id)
  await nested.getByLabel('Condition',{exact:true}).selectOption('greater_than_or_equal')
  await nested.getByLabel('Value',{exact:true}).fill('50')
  await nested.getByRole('button',{name:'Add condition',exact:true}).click()
  await nested.getByLabel('Question',{exact:true}).nth(1).selectOption(role.id)
  await nested.getByLabel('Answer',{exact:true}).selectOption(draft.choices.find(choice=>choice.label==='Decision maker')!.id)
  await rule.getByLabel('Then go to',{exact:true}).selectOption(qualified.id)
  await editor.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByText('Saved.',{exact:true})).toBeVisible()
  await page.screenshot({path:`test-results/${info.project.name}-conditions-builder.png`,fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.reload()
  await page.getByRole('button',{name:'Preview draft',exact:true}).click()
  const preview = page.getByRole('region',{name:'Draft preview',exact:true})
  await preview.getByRole('spinbutton',{name:'Company size',exact:true}).fill('100')
  await preview.getByRole('button',{name:'Continue preview',exact:true}).click()
  await preview.getByRole('radio',{name:'Decision maker',exact:true}).click()
  await preview.getByRole('button',{name:'Continue preview',exact:true}).click()
  await preview.getByRole('button',{name:'Inspect answer path',exact:true}).click()
  await expect(page.getByRole('region',{name:'Preview rule evaluations'})).toContainText('Company size: 100')
  await expect(page.getByRole('region',{name:'Preview rule evaluations'})).toContainText('AND group: true')
  await expect(page.getByRole('region',{name:'Preview rule evaluations'})).toContainText('OR group: true')
  await page.screenshot({path:`test-results/${info.project.name}-conditions-preview.png`,fullPage:true})
  await preview.getByRole('button',{name:'Close preview',exact:true}).click()
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  await expect(page.getByRole('region',{name:'Share this flow'})).toBeVisible()
  for (const [index, [count, choice, completion]] of ([[100,'Decision maker','Book a consultation'],[100,'Other','We will send you our guide'],[10,'Partner','Book a consultation'],[10,'Other','We will send you our guide']] as const).entries()) {
    await page.goto(`/f/${slug}`)
    await page.getByRole('spinbutton',{name:'Company size',exact:true}).fill(String(count))
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('radio',{name:choice,exact:true}).focus()
    await page.keyboard.press('Space')
    await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('textbox',{name:'How can we help?',exact:true}).fill('Please send the appropriate details.')
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    await page.waitForTimeout(3200)
    await page.getByRole('button',{name:'Submit response',exact:true}).click()
    await expect(page.getByRole('heading',{name:completion,exact:true})).toBeVisible()
    await page.screenshot({path:`test-results/${info.project.name}-conditions-completed-${index}.png`,fullPage:true})
  }
  const ledger = await call<{total:number}>(`${base}/ledger`)
  expect(ledger.total).toBe(4)
})
