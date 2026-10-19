import { expect } from './fixtures'
import { contract } from './contract'
import { signInEmptyWorkspace } from './authoring-helpers'
import { openStateDatabase,stateDatabaseFile } from './state-database'

contract('GOV-003','an owner opts into retention, sees advance notice, pauses deletion and releases legal hold',async({page},info)=>{
  await signInEmptyWorkspace(page)
  await page.getByRole('button',{name:'Customer feedback',exact:true}).click()
  await page.getByRole('button',{name:'Create draft flow'}).click()
  await expect(page.getByRole('heading',{name:'Customer feedback',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Publish',exact:true}).click()
  await page.locator('.retention-settings > summary').click()
  const panel=page.getByRole('region',{name:'Retention and legal hold'})
  await expect(panel.getByLabel('Retention period in days')).toHaveValue('')
  await panel.getByLabel('Retention period in days').fill('30')
  await expect(panel.getByRole('button',{name:'Save retention settings'})).toBeDisabled()
  await panel.getByLabel('I confirm automatic deletion',{exact:false}).check()
  await panel.getByRole('button',{name:'Save retention settings'}).click()
  await expect(panel.getByText('Retention settings saved.')).toBeVisible()
  const flowId=/\/flows\/([^/]+)\//.exec(new URL(page.url()).pathname)![1]
  // Native fixture supplies an already-aged response; scheduling and rendering
  // still use the real owner HTTP door.
  const db=openStateDatabase(stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!))
  try {
    const revision=db.prepare('SELECT id FROM flow_revisions WHERE flow_id=? AND published_at IS NOT NULL LIMIT 1').get(flowId) as {id:string}
    const workspace=db.prepare('SELECT workspace_id FROM flows WHERE id=?').get(flowId) as {workspace_id:string}
    const old='2000-01-01T00:00:00.000Z'
    db.prepare(`INSERT INTO responses(id,workspace_id,flow_id,revision_id,source,session_id,session_token_hash,idempotency_key,state,completed_at,created_at,updated_at,notification_eligible) VALUES(?,?,?,?, 'direct',?,?,?,'released',?,?,?,0)`).run(crypto.randomUUID(),workspace.workspace_id,flowId,revision.id,crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),old,old,old)
  } finally {db.close()}
  await panel.getByLabel('I confirm automatic deletion',{exact:false}).check()
  await panel.getByRole('button',{name:'Save retention settings'}).click()
  await expect(panel.getByText(/Advance deletion notice: 1 responses/)).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await panel.screenshot({path:`test-results/${info.project.name}-retention-notice.png`})
  await panel.getByLabel('Legal hold: pause all automatic deletion').check()
  await panel.getByRole('button',{name:'Save retention settings'}).click()
  await expect(panel.getByText('Legal hold is active. Automatic deletion is paused.')).toBeVisible()
  await page.reload()
  await page.getByRole('button',{name:'Share',exact:true}).click()
  await page.locator('.retention-settings > summary').click()
  await expect(panel.getByLabel('Legal hold: pause all automatic deletion')).toBeChecked()
  await panel.screenshot({path:`test-results/${info.project.name}-retention-hold.png`})
  await panel.getByLabel('Legal hold: pause all automatic deletion').uncheck()
  await panel.getByLabel('I confirm automatic deletion',{exact:false}).check()
  await panel.getByRole('button',{name:'Save retention settings'}).click()
  await expect(panel.getByText(/Advance deletion notice: 1 responses/)).toBeVisible()
  await panel.screenshot({path:`test-results/${info.project.name}-retention-release.png`})
})
