import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { contract } from './contract'

// The product page is the run site's (run-pencil.com), built by rer build --site; its note card hydrates on its own.
test.use({ baseURL: process.env.PENCIL_E2E_SITE_URL })

// The hero card is found by its semantics, not its copy: a labelled group of toggle buttons, and the polite live
// region beside them that announces the follow-up the chosen answer leads to.
function noteCard(page: Page) {
  const group = page.locator('[role="group"][aria-labelledby]:has(button[aria-pressed])')
  const card = group.locator('xpath=ancestor::*[.//*[@aria-live="polite"]][1]')
  return {
    group,
    card,
    buttons: group.getByRole('button'),
    followUp: card.locator('[aria-live="polite"]'),
    hydrated: page.locator('[data-hydrated="true"]'),
  }
}

async function pressedStates(buttons: Locator) {
  return buttons.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-pressed')))
}

async function expectOnlyPressed(buttons: Locator, index: number) {
  const count = await buttons.count()
  for (let at = 0; at < count; at++) await expect(buttons.nth(at)).toHaveAttribute('aria-pressed', at === index ? 'true' : 'false')
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  contract('SITE-002', 'the note card shows one complete question, answer and follow-up', async ({ page }) => {
    await page.goto('/')
    const { group, buttons, followUp } = noteCard(page)
    await expect(group).toHaveAccessibleName(/\S/)
    const states = await pressedStates(buttons)
    expect(states.length).toBeGreaterThanOrEqual(2)
    expect(states.filter(state => state === 'true')).toHaveLength(1)
    expect(states.filter(state => state === 'false')).toHaveLength(states.length - 1)
    await expect(followUp).toHaveText(/\S/)
  })
})

contract('SITE-002', 'choosing an answer by pointer or keyboard shows the follow-up that answer leads to', async ({ page }) => {
  await page.goto('/')
  const { group, buttons, followUp, hydrated } = noteCard(page)
  await expect(hydrated.first()).toBeVisible()
  await expect(group).toHaveAccessibleName(/\S/)
  const count = await buttons.count()
  expect(count).toBeGreaterThanOrEqual(2)

  // Pointer: every answer in turn becomes the only pressed one and announces its own, non-empty follow-up.
  const initial = (await pressedStates(buttons)).indexOf('true')
  await expectOnlyPressed(buttons, initial)
  const byPointer: string[] = []
  byPointer[initial] = (await followUp.textContent())!.trim()
  for (let step = 1; step < count; step++) {
    const index = (initial + step) % count
    await buttons.nth(index).click()
    await expectOnlyPressed(buttons, index)
    await expect(followUp).not.toHaveText(byPointer[(initial + step - 1) % count])
    byPointer[index] = (await followUp.textContent())!.trim()
  }
  expect(byPointer.every(Boolean)).toBe(true)
  expect(new Set(byPointer).size).toBe(count)

  // Keyboard: walking back with Shift+Tab, Enter on one answer and Space on the next choose them, with the same follow-ups.
  const last = (initial + count - 1) % count
  await expect(buttons.nth(last)).toHaveAttribute('aria-pressed', 'true')
  for (let step = 1; step < count; step++) {
    const index = (last - step + count) % count
    await page.keyboard.press('Shift+Tab')
    await expect(buttons.nth(index)).toBeFocused()
    await page.keyboard.press(step % 2 ? 'Enter' : 'Space')
    await expectOnlyPressed(buttons, index)
    await expect(followUp).toHaveText(byPointer[index])
  }
})

test.describe('with reduced motion', () => {
  contract('SITE-002', 'choosing an answer shows its follow-up at once, with nothing left animating on the card', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const { buttons, followUp, card, hydrated } = noteCard(page)
    await expect(hydrated.first()).toBeVisible()
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    const before = (await followUp.textContent())!.trim()
    const target = (await pressedStates(buttons)).indexOf('true') === 0 ? 1 : 0
    await buttons.nth(target).click()
    await expectOnlyPressed(buttons, target)
    // At once: a short timeout leaves no room for a pencil stroke or a rubbing-out to play first.
    await expect(followUp).not.toHaveText(before, { timeout: 300 })
    await expect(followUp).toBeVisible()
    const running = await card.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)
    expect(running).toBe(0)
  })
})
