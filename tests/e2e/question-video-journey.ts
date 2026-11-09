import type { Locator, Page, Request, Route } from '@playwright/test'
import { ulid } from 'ulid'
import type { BuilderDraft, PublicFlow } from '../../src/core/app/api'
import { expect } from './fixtures'
import { addStep } from './authoring-helpers'

/** Extends the authoring journey with revision-owned, explicitly activated video. */
export async function questionVideoJourney(page: Page, project: string) {
  const assertBehaviour = project === 'desktop'
  const origin = new URL(page.url()).origin
  const external: string[] = []
  const record = (request: Request) => {
    const url = new URL(request.url())
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) external.push(url.href)
  }
  const providerPattern = /^https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//
  const provider = async (route: Route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><title>Synthetic provider player</title><body><p>Synthetic provider player</p></body></html>',
  })
  const youtube = { provider: 'youtube', reference: 'pencilvid01' }
  const vimeo = { provider: 'vimeo', reference: '123456789' }
  const youtubeUrl = 'https://www.youtube.com/watch?v=pencilvid01'
  const vimeoUrl = 'https://vimeo.com/123456789'
  const youtubeEmbed = 'https://www.youtube-nocookie.com/embed/pencilvid01?autoplay=1'
  const vimeoEmbed = 'https://player.vimeo.com/video/123456789?dnt=1&autoplay=1'
  const readDraft = async (base: string) => (await page.request.get(`${base}/draft`)).json() as Promise<BuilderDraft>
  const pendingVideo = async (scope: Locator, name: string) => {
    await scope.getByRole('button', { name: 'Play video', exact: true }).waitFor({ state: 'visible' })
    if (assertBehaviour) {
      await expect(scope).toContainText(name)
      await expect(scope.locator('iframe, img')).toHaveCount(0)
      expect(external).toEqual([])
      expect(await page.evaluate(installationOrigin => Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="preconnect"], link[rel~="dns-prefetch"]')).map(link => new URL(link.href, location.href).origin).filter(value => value !== installationOrigin), origin)).toEqual([])
    }
  }
  const play = async (scope: Locator, name: string, url: string, key: 'Enter' | 'Space') => {
    const control = scope.getByRole('button', { name: 'Play video', exact: true })
    await control.focus()
    if (assertBehaviour) await expect(control).toBeFocused()
    await page.keyboard.press(key)
    const frame = scope.locator('iframe')
    await scope.frameLocator('iframe').getByText('Synthetic provider player', { exact: true }).waitFor({ state: 'visible' })
    if (assertBehaviour) {
      await expect(frame).toHaveAttribute('src', url)
      await expect(frame).toHaveAttribute('title', `${name} video`)
      expect(external).toEqual([url])
    }
  }
  page.on('request', record)
  await page.route(providerPattern, provider)
  try {
    await page.getByRole('button', { name: 'New flow', exact: true }).click()
    await page.getByRole('button', { name: 'Blank flow', exact: true }).click()
    await page.getByLabel('Flow name', { exact: true }).fill('Synthetic question video')
    const slug = `synthetic-pencil-video-${ulid().toLowerCase()}`
    await page.getByLabel('Public link', { exact: true }).fill(slug)
    await page.getByRole('button', { name: 'Create draft flow', exact: true }).click()
    const rail = page.getByRole('complementary', { name: 'Flow steps' })
    const editor = page.getByRole('complementary', { name: 'Step settings' })
    const videoField = async () => {
      const field = editor.getByLabel('Video URL', { exact: true })
      if (!await field.isVisible()) await editor.locator('summary').filter({ hasText: /^Video$/ }).click()
      await field.waitFor({ state: 'visible' })
      return field
    }
    const save = async () => {
      await editor.getByRole('button', { name: 'Save', exact: true }).click()
      await page.getByText('Saved.', { exact: true }).waitFor({ state: 'visible' })
    }
    await addStep(rail, 'Add question')
    const builderUrl = page.url()
    const flowId = /flows\/([^/]+)\//.exec(builderUrl)![1]
    const base = `/api/app/flows/${flowId}`
    await editor.getByLabel('Prompt', { exact: true }).fill('What did you notice?')
    await editor.getByLabel('Required response', { exact: true }).check()
    if (assertBehaviour) {
      const before = await readDraft(base)
      for (const url of ['https://unapproved.example/watch?v=pencilvid01', 'http://www.youtube.com/watch?v=pencilvid01', 'https://www.youtube.com/watch?v=short']) {
        await (await videoField()).fill(url)
        await expect(editor.getByLabel('Video URL', { exact: true })).toHaveAttribute('aria-invalid', 'true')
        const refusal = page.waitForResponse(response => response.url().endsWith(`${base}/draft`) && response.request().method() === 'PUT')
        await editor.getByRole('button', { name: 'Save', exact: true }).click()
        expect((await refusal).status()).toBe(400)
        await expect(page.getByRole('alert').filter({ hasText: 'Question video settings are invalid.' })).toBeVisible()
        expect(await readDraft(base)).toEqual(before)
      }
    }
    await (await videoField()).fill(youtubeUrl)
    await save()
    await editor.getByLabel('Question type', { exact: true }).selectOption('long_text')
    await save()
    const question = (await readDraft(base)).steps.find(step => step.kind === 'question')!
    if (assertBehaviour) {
      expect(question.questionType).toBe('long_text')
      expect(question.questionSettings?.video).toEqual(youtube)
    }
    await addStep(rail, 'Add completion screen')
    await editor.getByLabel('Prompt', { exact: true }).fill('Your observation is recorded.')
    await save()
    await rail.getByRole('button', { name: /What did you notice/ }).click()
    await page.reload()
    await videoField()
    if (assertBehaviour) await expect(editor.getByLabel('Video URL', { exact: true })).toHaveValue(youtubeUrl)
    const canvasVideo = page.getByLabel('Draft question canvas').getByRole('region', { name: 'Question video', exact: true })
    await pendingVideo(canvasVideo, 'YouTube')
    await page.screenshot({ path: `test-results/${project}-video-builder.png`, fullPage: true })
    await play(canvasVideo, 'YouTube', youtubeEmbed, 'Enter')
    await page.reload()
    await videoField()
    external.length = 0
    await page.getByRole('button', { name: 'Preview draft', exact: true }).click()
    const preview = page.getByRole('region', { name: 'Draft preview', exact: true })
    const previewVideo = preview.getByRole('region', { name: 'Question video', exact: true })
    await pendingVideo(previewVideo, 'YouTube')
    await page.screenshot({ path: `test-results/${project}-video-preview.png`, fullPage: true })
    await play(previewVideo, 'YouTube', youtubeEmbed, 'Space')
    await preview.getByRole('textbox', { name: 'What did you notice?', exact: true }).fill('Preview stays private')
    await preview.getByRole('button', { name: 'Continue preview', exact: true }).click()
    await preview.getByText('Preview complete', { exact: true }).waitFor({ state: 'visible' })
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await page.getByText('Published. New visitors see this version.', { exact: true }).waitFor({ state: 'visible' })
    const published = await (await page.request.get(`/api/public/flows/${slug}`)).json() as PublicFlow
    if (assertBehaviour) expect(published.steps.find(step => step.id === question.id)?.questionSettings?.video).toEqual(youtube)
    await page.getByRole('button', { name: 'Edit steps', exact: true }).click()
    await (await videoField()).fill(vimeoUrl)
    await save()
    await page.reload()
    await videoField()
    if (assertBehaviour) {
      await expect(editor.getByLabel('Video URL', { exact: true })).toHaveValue(vimeoUrl)
      expect((await readDraft(base)).steps.find(step => step.id === question.id)?.questionSettings?.video).toEqual(vimeo)
      expect((await (await page.request.get(`/api/public/flows/${slug}`)).json() as PublicFlow).steps.find(step => step.id === question.id)?.questionSettings?.video).toEqual(youtube)
    }
    external.length = 0
    await page.getByRole('button', { name: 'Preview draft', exact: true }).click()
    await pendingVideo(previewVideo, 'Vimeo')
    await play(previewVideo, 'Vimeo', vimeoEmbed, 'Enter')
    await page.screenshot({ path: `test-results/${project}-video-vimeo-preview.png`, fullPage: true })
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
    external.length = 0
    const viewed = page.waitForResponse(response => response.url().endsWith(`/api/public/flows/${slug}/views`) && response.request().method() === 'POST')
    await page.goto(`/f/${slug}`)
    await viewed
    const publicStart = Date.now()
    await page.locator('.respondent-shell[data-hydrated=true]').waitFor({ state: 'visible' })
    const publicVideo = page.getByRole('region', { name: 'Question video', exact: true })
    await pendingVideo(publicVideo, 'YouTube')
    await page.screenshot({ path: `test-results/${project}-video-public-before-play.png`, fullPage: true })
    await play(publicVideo, 'YouTube', youtubeEmbed, 'Space')
    await page.screenshot({ path: `test-results/${project}-video-public-playing.png`, fullPage: true })
    await page.getByRole('textbox', { name: 'What did you notice?', exact: true }).fill('Synthetic native observation')
    // Give the real admission timer its ordinary three seconds, without changing storage or the clock.
    const remaining = 3200 - (Date.now() - publicStart)
    if (remaining > 0) await page.waitForTimeout(remaining)
    const submission = page.waitForResponse(response => response.url().endsWith(`/api/public/flows/${slug}/responses`) && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    const receipt = await (await submission).json()
    await page.getByRole('heading', { name: 'Your observation is recorded.', exact: true }).waitFor({ state: 'visible' })
    if (assertBehaviour) {
      expect(receipt).toMatchObject({ disposition: 'released', idempotent: false })
      const ledger = await (await page.request.get(`${base}/ledger`)).json()
      expect(ledger.responses).toHaveLength(1)
      expect(ledger.responses[0].answers).toEqual([expect.objectContaining({ stepId: question.id, value: 'Synthetic native observation' })])
      expect(external).toEqual([youtubeEmbed])
    }
    // Only explicit publication replaces the live video's revision-owned reference.
    await page.goto(builderUrl)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await page.getByText('Published. New visitors see this version.', { exact: true }).waitFor({ state: 'visible' })
    if (assertBehaviour) {
      const current = await (await page.request.get(`/api/public/flows/${slug}`)).json() as PublicFlow
      expect(current.revision.id).not.toBe(published.revision.id)
      expect(current.steps.find(step => step.id === question.id)?.questionSettings?.video).toEqual(vimeo)
    }
    external.length = 0
    await page.goto(`/f/${slug}`)
    await page.locator('.respondent-shell[data-hydrated=true]').waitFor({ state: 'visible' })
    await pendingVideo(publicVideo, 'Vimeo')
    await page.screenshot({ path: `test-results/${project}-video-vimeo-public-before-play.png`, fullPage: true })
    await play(publicVideo, 'Vimeo', vimeoEmbed, 'Enter')
    await page.screenshot({ path: `test-results/${project}-video-vimeo-public-playing.png`, fullPage: true })
  } finally {
    page.off('request', record)
    await page.unroute(providerPattern, provider)
  }
}
