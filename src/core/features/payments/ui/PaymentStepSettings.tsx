import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { BuilderDraft, FlowStep } from '../../../app/api'
import { formatUsd, paymentLimits, type PaymentProduct, type PaymentSettings } from '../../../shared/payments'
import { paymentConnectionStatus, type PaymentConnectionStatus } from './PaymentConnection'
import './payments.css'

const blank: PaymentSettings = { products: [], options: [], minimum: 100, maximum: 100_000 }
const choiceTypes = ['single_choice', 'multiple_choice', 'dropdown']

function UsdField({ label, cents, disabled, onChange }: { label: string; cents: number; disabled: boolean; onChange: (cents: number) => void }) {
  return <label className="inspector-field">{label}<input aria-label={label} className="text-input" type="number" inputMode="decimal" min={0} step={0.01} disabled={disabled} value={cents / 100} onChange={event => onChange(Math.round(Number(event.target.value || 0) * 100))} /></label>
}

/** PAY-001 pricing for one payment step: fixed products in USD with fixed or answered quantities, prices on the choices
 * of earlier choice questions, or a numeric LOGIC-003 calculation; always with a minimum and maximum charge. */
export function PaymentStepSettings({ draft, step, value, disabled, onChange }: { draft: BuilderDraft; step: FlowStep; value: unknown; disabled: boolean; onChange: (next: PaymentSettings) => void }) {
  const settings = value && typeof value === 'object' ? { ...blank, ...value as PaymentSettings } : blank
  const [connection, setConnection] = useState<PaymentConnectionStatus | null>()
  useEffect(() => { void paymentConnectionStatus().then(setConnection).catch(() => setConnection(null)) }, [])
  const earlier = draft.steps.filter(candidate => candidate.kind === 'question' && candidate.position < step.position)
  const numbers = earlier.filter(candidate => candidate.questionType === 'number'), choiceQuestions = earlier.filter(candidate => choiceTypes.includes(candidate.questionType ?? ''))
  const calculations = (draft.formSettings?.calculations ?? []).filter(calculation => calculation.type === 'number')
  const calculated = settings.calculationId !== undefined
  const change = (next: Partial<PaymentSettings>) => onChange({ ...settings, ...next })
  const product = (index: number, next: Partial<PaymentProduct>) => change({ products: settings.products.map((item, position) => position === index ? Object.fromEntries(Object.entries({ ...item, ...next }).filter(([, entry]) => entry !== undefined)) as PaymentProduct : item) })
  return <section className="payment-pricing" aria-label="Payment pricing">
    <p className="muted" aria-busy={connection === undefined}>{connection === undefined ? 'Checking the Stripe connection…' : connection?.saved ? `Stripe is connected in ${connection.mode} mode.` : 'Stripe is not connected yet. The owner connects it in Settings; until then respondents cannot pay.'}</p>
    <fieldset disabled={disabled}><legend>Payment mode</legend>
      <label className="inspector-field">Payment mode<select aria-label="Payment mode" className="text-input" value={settings.mode??'one_time'} onChange={event=>change({mode:event.target.value as PaymentSettings['mode'],priceId:undefined,interval:undefined,customDonation:false})}><option value="one_time">One-time payment</option><option value="subscription">Subscription</option><option value="donation">Donation</option></select></label>
      {settings.mode==='subscription'?<><label className="inspector-field">Stripe price ID<input aria-label="Stripe price ID" className="text-input" maxLength={200} value={settings.priceId??''} onChange={event=>change({priceId:event.target.value||undefined})}/></label><p className="muted">Use one fixed product amount matching the active USD price in Stripe. Pencil verifies it before starting checkout.</p></>:null}
      {settings.mode==='subscription'||settings.mode==='donation'?<label className="inspector-field">Billing interval<select aria-label="Billing interval" className="text-input" value={settings.interval??''} disabled={settings.customDonation} onChange={event=>change({interval:event.target.value as PaymentSettings['interval']||undefined})}>{settings.mode==='donation'?<option value="">One-time donation</option>:<option value="">Choose interval</option>}<option value="month">Monthly</option><option value="year">Yearly</option></select></label>:null}
      {settings.mode==='donation'?<><label className="payment-choice"><input type="checkbox" checked={settings.customDonation??false} onChange={event=>change({customDonation:event.target.checked,...(event.target.checked?{interval:undefined}:{})})}/><span>Choose custom amount on Stripe</span></label><p className="muted">For custom donations, use one fixed product as the suggested amount. Checkout lets the donor change it within your charge limits. Recurring donations use a fixed suggested amount.</p></>:null}
    </fieldset>
    <fieldset disabled={disabled}><legend>Amount</legend>
      <label className="payment-choice"><input type="radio" name={`pricing-${step.id}`} checked={!calculated} onChange={() => onChange({ ...settings, calculationId: undefined })} /><span>Products and option prices</span></label>
      <label className="payment-choice"><input type="radio" name={`pricing-${step.id}`} checked={calculated} disabled={!calculations.length} onChange={() => onChange({ ...settings, products: [], options: [], calculationId: calculations[0]?.id })} /><span>Calculated amount{calculations.length ? '' : ' (add a numeric calculation first)'}</span></label>
      {calculated ? <label className="inspector-field">Calculation charged<select aria-label="Calculation charged" className="text-input" value={settings.calculationId} onChange={event => change({ calculationId: event.target.value })}>{calculations.map(calculation => <option key={calculation.id} value={calculation.id}>{calculation.name} (dollars)</option>)}</select></label> : null}
    </fieldset>
    {!calculated ? <fieldset disabled={disabled}><legend>Products</legend>
      {settings.products.map((item, index) => <div className="payment-product" key={item.id}>
        <label className="inspector-field">Product {index + 1} name<input aria-label={`Product ${index + 1} name`} className="text-input" maxLength={paymentLimits.nameCharacters} value={item.name} onChange={event => product(index, { name: event.target.value })} /></label>
        <UsdField label={`Product ${index + 1} price (USD)`} cents={item.unitAmount} disabled={disabled} onChange={unitAmount => product(index, { unitAmount })} />
        <label className="inspector-field">Product {index + 1} quantity<select aria-label={`Product ${index + 1} quantity`} className="text-input" value={item.quantityStepId ?? 'fixed'} onChange={event => product(index, event.target.value === 'fixed' ? { quantityStepId: undefined, quantity: 1 } : { quantityStepId: event.target.value, quantity: undefined })}><option value="fixed">Fixed quantity</option>{numbers.map(question => <option key={question.id} value={question.id}>Answer to “{question.prompt}”</option>)}</select></label>
        {item.quantityStepId === undefined ? <label className="inspector-field">Product {index + 1} fixed quantity<input aria-label={`Product ${index + 1} fixed quantity`} className="text-input" type="number" min={1} max={paymentLimits.quantity} step={1} value={item.quantity ?? 1} onChange={event => product(index, { quantity: Math.max(1, Math.round(Number(event.target.value || 1))) })} /></label> : null}
        <button className="quiet-button focus-ring" type="button" onClick={() => change({ products: settings.products.filter((_, position) => position !== index) })}><Trash2 aria-hidden="true" size={15} /> Remove product {index + 1}</button>
      </div>)}
      <button className="secondary-button focus-ring" type="button" disabled={settings.products.length >= paymentLimits.products} onClick={() => change({ products: [...settings.products, { id: crypto.randomUUID(), name: 'Order', unitAmount: 1000, quantity: 1 }] })}><Plus aria-hidden="true" size={15} /> Add product</button>
    </fieldset> : null}
    {!calculated ? <fieldset disabled={disabled}><legend>Option prices</legend>
      {settings.options.map((option, index) => { const question = earlier.find(candidate => candidate.id === option.stepId); return <div className="payment-pricing" key={option.stepId}>
        <p><strong>{question?.prompt ?? 'Missing question'}</strong></p>
        {draft.choices.filter(choice => choice.stepId === option.stepId).map(choice => <UsdField key={choice.id} label={`Price for ${choice.label}`} cents={option.prices[choice.id] ?? 0} disabled={disabled} onChange={price => change({ options: settings.options.map((entry, position) => position === index ? { ...entry, prices: { ...entry.prices, [choice.id]: price } } : entry) })} />)}
        <button className="quiet-button focus-ring" type="button" onClick={() => change({ options: settings.options.filter((_, position) => position !== index) })}><Trash2 aria-hidden="true" size={15} /> Remove option prices</button>
      </div> })}
      {choiceQuestions.some(question => !settings.options.some(option => option.stepId === question.id)) ? <label className="inspector-field">Price the choices of<select aria-label="Price the choices of" className="text-input" value="" onChange={event => { if (event.target.value) change({ options: [...settings.options, { stepId: event.target.value, prices: {} }] }) }}><option value="">Choose an earlier choice question</option>{choiceQuestions.filter(question => !settings.options.some(option => option.stepId === question.id)).map(question => <option key={question.id} value={question.id}>{question.prompt}</option>)}</select></label> : null}
    </fieldset> : null}
    <fieldset disabled={disabled}><legend>Payment methods</legend>
      <p>Stripe Checkout offers cards, Apple Pay and Google Pay when the device and Stripe account support them.</p>
      <label className="payment-choice"><input type="checkbox" checked={settings.ach??false} onChange={event=>change({ach:event.target.checked})}/><span>Offer ACH bank payments</span></label>
      <p className="muted">ACH payments stay processing until Stripe confirms success or failure. Only paid responses count toward admission limits.</p>
    </fieldset>
    <fieldset disabled={disabled}><legend>Tax, discounts and receipts</legend>
      <label className="payment-choice"><input type="checkbox" checked={settings.automaticTax ?? false} onChange={event => change({ automaticTax: event.target.checked })} /><span>Use Stripe Tax</span></label>
      <p className="muted">Checkout collects the billing address for tax. Pencil stores no address.</p>
      <label className="payment-choice"><input type="checkbox" checked={settings.promotionCodes ?? false} onChange={event => change({ promotionCodes: event.target.checked, ...(event.target.checked ? { couponId: undefined } : {}) })} /><span>Allow promotion codes</span></label>
      <label className="inspector-field">Stripe coupon ID<input className="text-input" value={settings.couponId ?? ''} maxLength={200} disabled={settings.promotionCodes} onChange={event => change({ couponId: event.target.value || undefined })} /></label>
      <label className="payment-choice"><input type="checkbox" checked={settings.receipts ?? false} onChange={event => change({ receipts: event.target.checked })} /><span>Collect email for Stripe receipts</span></label>
      <p className="muted">Stripe sends receipts to the email collected by Checkout when receipts are enabled in your Stripe account. Pencil forwards no answer as an email address.</p>
    </fieldset>
    <fieldset disabled={disabled}><legend>Charge limits</legend>
      <UsdField label="Minimum charge (USD)" cents={settings.minimum} disabled={disabled} onChange={minimum => change({ minimum })} />
      <UsdField label="Maximum charge (USD)" cents={settings.maximum} disabled={disabled} onChange={maximum => change({ maximum })} />
      <p className="muted">Stripe charges between {formatUsd(paymentLimits.minimum)} and {formatUsd(paymentLimits.maximum)}. Publishing checks that every possible total falls within these limits.</p>
    </fieldset>
  </section>
}
