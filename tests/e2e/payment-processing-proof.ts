import type { Page, TestInfo } from '@playwright/test'
import type { Ledger, PaymentReturnView } from '../../src/core/app/api'
import { expect } from './fixtures'
import type { startStripeReceiver } from './stripe-receiver'

export async function provePaymentProcessing(page: Page, info: TestInfo, stripe: Awaited<ReturnType<typeof startStripeReceiver>>, flowId: string, slug: string) {
  const responsesPath = `/api/public/flows/${slug}/responses`
  const submitted = page.waitForResponse(response => new URL(response.url()).pathname === responsesPath && response.request().method() === 'POST')
  await page.getByRole('button', { name: /Pay.*40/ }).click()
  expect((await submitted).status()).toBe(201)
  await expect(page.getByRole('heading', { name: 'Test checkout', exact: true })).toBeVisible()
  const bank = stripe.sessions.get(new URL(page.url()).pathname.split('/').at(-1)!)!
  expect(bank.ach).toBe(true)
  expect(bank.status).toBe('open')
  expect(bank.payment_status).toBe('unpaid')
  const responseId = bank.metadata.pencil_response
  const paymentReturn = () => page.waitForResponse(response => new URL(response.url()).pathname === `/api/public/flows/${slug}/payments/return` && response.ok()).then(response => response.json() as Promise<PaymentReturnView>)
  const initialReturn = paymentReturn()
  await page.getByRole('button', { name: 'Pay $40.00', exact: true }).click()
  expect(await initialReturn).toMatchObject({ state: 'completed', payment: { state: 'processing' } })

  const notice = page.getByRole('status', { name: 'Payment status', exact: true })
  const ledger = async () => {
    const response = await page.request.get(`/api/app/flows/${flowId}/ledger`)
    expect(response.ok()).toBe(true)
    return response.json() as Promise<Ledger>
  }
  const sameResponse = async (state: 'processing' | 'paid', ids?: string[]) => {
    const stored = await ledger()
    if (ids) expect(stored.responses.map(response => response.id).sort()).toEqual(ids)
    const matching = stored.responses.filter(response => response.id === responseId)
    expect(matching).toHaveLength(1)
    expect(matching[0].payment).toMatchObject({ state, amount: 4000, checkoutSessionId: bank.id, attempt: 1 })
    return stored
  }
  const pending = async () => {
    await expect(notice).toContainText('Payment processing')
    await expect(notice).toContainText('not paid yet')
    await expect(notice).not.toContainText('Your payment is received.')
    await expect(notice).toHaveAttribute('aria-live', 'polite')
    await expect(notice).toHaveAttribute('aria-atomic', 'true')
    await expect(notice.locator('svg.lucide-clock-3')).toBeVisible()
    await expect(notice.locator('svg.lucide-check')).toHaveCount(0)
    await expect(notice).toHaveAttribute('data-state', 'processing')
  }
  const capture = async (state: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const path = info.outputPath(`ach-respondent-${state}-${info.project.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await info.attach(`ACH respondent ${state} · ${info.project.name}`, { path, contentType: 'image/png' })
  }
  await pending()
  const returnUrl = page.url()
  expect(new URL(returnUrl).pathname).toBe(`/f/${slug}`)
  expect(new URL(returnUrl).searchParams.get('payment-return')).toBe('success')
  const original = await sameResponse('processing')
  const ids = original.responses.map(response => response.id).sort()
  const originalAnswers = original.responses.find(response => response.id === responseId)!.answers
  const pendingVisual = await notice.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, icon: getComputedStyle(element.querySelector('svg')!).color }))
  await capture('processing')

  const returned = paymentReturn()
  await page.reload()
  expect(await returned).toMatchObject({ state: 'completed', payment: { state: 'processing' } })
  expect(page.url()).toBe(returnUrl)
  await pending()
  await sameResponse('processing', ids)

  await page.goto(`/app/flows/${flowId}/results`)
  await page.getByRole('button', { name: 'View answers', exact: true }).first().click()
  const bankRecord = page.getByRole('region', { name: 'Payment', exact: true })
  await expect(bankRecord).toContainText('Payment processing')
  await bankRecord.screenshot({ path: info.outputPath(`ach-processing-${info.project.name}.png`) })
  bank.payment_status = 'paid'
  await stripe.event('checkout.session.async_payment_succeeded', bank)
  await stripe.event('charge.succeeded', { id: 'synthetic-pencil-1', payment_intent: bank.payment_intent, payment_method_details: { type: 'us_bank_account', us_bank_account: { last4: '6789' } } })
  await page.reload()
  await page.getByRole('button', { name: 'View answers', exact: true }).first().click()
  await expect(bankRecord).toContainText('Paid')
  await expect(bankRecord).toContainText('US bank account (ACH) · ending 6789')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await bankRecord.screenshot({ path: info.outputPath(`ach-paid-${info.project.name}.png`) })

  const settledReturn = paymentReturn()
  await page.goto(returnUrl)
  expect(await settledReturn).toMatchObject({ state: 'completed', payment: { state: 'paid' } })
  await expect(notice).toContainText('Your payment is received.')
  await expect(notice).not.toContainText('Payment processing')
  await expect(notice).toHaveAttribute('data-state', 'paid')
  await expect(notice.locator('svg.lucide-check')).toBeVisible()
  await expect(notice.locator('svg.lucide-clock-3')).toHaveCount(0)
  const paidVisual = await notice.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, icon: getComputedStyle(element.querySelector('svg')!).color }))
  expect(pendingVisual.background).not.toBe(paidVisual.background)
  expect(pendingVisual.icon).not.toBe(paidVisual.icon)
  const paid = await sameResponse('paid', ids)
  expect(paid.responses.find(response => response.id === responseId)!.answers).toEqual(originalAnswers)
  await capture('paid')
}
