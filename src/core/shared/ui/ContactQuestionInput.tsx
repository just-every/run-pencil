import { useAnswerAccessibility } from './AnswerFieldset'
import { useId, useState } from 'react'
import type { FlowStep } from '../../app/api'
import { contactFieldIssues } from '../contactAnswers'
import { contactCountryCodes } from '../contactAddress'
import { currencyDecimal } from '../contactCurrency'
import { displayPhone, phoneNumber } from '../contactPhone'
import type { CurrencyAnswer } from '../contactSchemas'
import './contact-fields.css'

type Props = { step: FlowStep; value: unknown; onChange: (value: unknown) => void }
type Field = { key: string; label: string; maximum: number; autoComplete?: string; required?: boolean; inputMode?: 'tel' | 'numeric' | 'decimal' | 'url'; hint?: string }
const countryNames = new Intl.DisplayNames(['en-US'], { type: 'region' })
const countries = contactCountryCodes.map(code => ({ code, name: countryNames.of(code)! })).sort((left, right) => left.name.localeCompare(right.name))

function initialParts(type: string, value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const parts = Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    if (type === 'phone' && parts.number && phoneNumber(parts.number)) parts.number = displayPhone({ number: phoneNumber(parts.number)! })
    return parts
  }
  return type === 'postal_address' ? { country: 'US' } : {}
}

export function ContactQuestionInput({ step, value, onChange }: Props) {
  const accessibility = useAnswerAccessibility()
  const id = useId(), type = String(step.questionType)
  const [parts, setParts] = useState(() => initialParts(type, value))
  const [scalar, setScalar] = useState(() => typeof value === 'string' ? value : type === 'currency' && value && typeof value === 'object' && 'minorUnits' in value ? currencyDecimal(value as CurrencyAnswer) : '')
  const country = parts.country ?? 'US'
  const issues = value === undefined ? {} : contactFieldIssues(type, value)
  const change = (key: string, text: string) => {
    const next = { ...parts, [key]: text }
    setParts(next)
    // Selecting a country alone is not an address answer.
    if (!Object.entries(next).some(([field, item]) => field !== 'country' && item.trim())) { onChange(undefined); return }
    if (type === 'phone') onChange({ number: next.number ?? '', ...(next.extension ? { extension: next.extension } : {}) })
    if (type === 'full_name') onChange({ given: next.given ?? '', family: next.family ?? '', ...(next.middle ? { middle: next.middle } : {}), ...(next.suffix ? { suffix: next.suffix } : {}) })
    if (type === 'postal_address') onChange({ street: next.street ?? '', city: next.city ?? '', state: next.state ?? '', postalCode: next.postalCode ?? '', country: next.country ?? 'US', ...(next.unit ? { unit: next.unit } : {}) })
  }
  const field = ({ key, label, maximum, autoComplete, required = false, inputMode, hint }: Field) => <div className="contact-field" key={key}>
    <label htmlFor={`${id}-${key}`}>{label}</label>
    <input id={`${id}-${key}`} className="text-input" type="text" inputMode={inputMode} autoComplete={autoComplete ?? 'off'} maxLength={maximum}
      value={parts[key] ?? ''} onChange={event => change(key, event.target.value)} onBlur={() => {
        if (type === 'phone' && key === 'number') {
          const number = phoneNumber(parts.number ?? '')
          if (number) setParts(current => ({ ...current, number: displayPhone({ number }) }))
        }
      }} aria-required={required && (step.required || value !== undefined)} {...accessibility([hint ? `${id}-${key}-hint` : '', issues[key] ? `${id}-${key}-error` : ''].filter(Boolean).join(' ') || undefined,Boolean(issues[key]))} />
    {hint ? <p className="muted contact-field-hint" id={`${id}-${key}-hint`}>{hint}</p> : null}
    {issues[key] ? <p className="contact-field-error" id={`${id}-${key}-error`} role="alert">{issues[key]}</p> : null}
  </div>

  if (type === 'url' || type === 'currency') {
    const errorKey = type === 'url' ? 'url' : 'minorUnits'
    return <div className="answer-stack contact-fields">
      <label htmlFor={`${id}-scalar`}>{type === 'url' ? 'Website URL' : 'Amount in USD'}</label>
      <input id={`${id}-scalar`} className="text-input" type="text" inputMode={type === 'url' ? 'url' : 'decimal'} autoComplete={type === 'url' ? 'url' : 'off'} maxLength={type === 'url' ? 2048 : 40}
        value={scalar} onChange={event => { setScalar(event.target.value); onChange(event.target.value.trim() ? event.target.value : undefined) }}
        aria-required={step.required} {...accessibility(`${id}-hint${issues[errorKey] ? ` ${id}-error` : ''}`,Boolean(issues[errorKey]))} />
      <p className="muted contact-field-hint" id={`${id}-hint`}>{type === 'url' ? 'Include http:// or https://.' : 'US dollars, with up to two decimal places.'}</p>
      {issues[errorKey] ? <p className="contact-field-error" id={`${id}-error`} role="alert">{issues[errorKey]}</p> : null}
    </div>
  }
  return <div className="answer-stack contact-fields" role="group" aria-label={step.prompt}>
    {type === 'phone' ? <>
      {field({ key: 'number', label: 'Phone number', maximum: 80, autoComplete: 'tel', inputMode: 'tel', required: true, hint: 'US phone number, or international number with + and country code.' })}
      {field({ key: 'extension', label: 'Extension (optional)', maximum: 10, autoComplete: 'tel-extension', inputMode: 'numeric' })}
    </> : null}
    {type === 'full_name' ? <div className="contact-fields-grid">
      {field({ key: 'given', label: 'Given name', maximum: 100, autoComplete: 'given-name', required: true })}
      {field({ key: 'family', label: 'Family name', maximum: 100, autoComplete: 'family-name', required: true })}
      {field({ key: 'middle', label: 'Middle name (optional)', maximum: 100, autoComplete: 'additional-name' })}
      {field({ key: 'suffix', label: 'Suffix (optional)', maximum: 30, autoComplete: 'honorific-suffix' })}
    </div> : null}
    {type === 'postal_address' ? <>
      <div className="contact-field"><label htmlFor={`${id}-country`}>Country</label>
        <select id={`${id}-country`} className="text-input" autoComplete="country" value={country} onChange={event => change('country', event.target.value)} aria-required={step.required || value !== undefined} {...accessibility(issues.country ? `${id}-country-error` : undefined,Boolean(issues.country))}>
          {countries.map(item => <option value={item.code} key={item.code}>{item.name}</option>)}
        </select>
        {issues.country ? <p className="contact-field-error" id={`${id}-country-error`} role="alert">{issues.country}</p> : null}
      </div>
      {field({ key: 'street', label: 'Street address', maximum: 200, autoComplete: 'address-line1', required: true })}
      {field({ key: 'unit', label: 'Apartment, suite or unit (optional)', maximum: 100, autoComplete: 'address-line2' })}
      {field({ key: 'city', label: 'City', maximum: 100, autoComplete: 'address-level2', required: true })}
      <div className="contact-fields-grid">
        {field({ key: 'state', label: country === 'US' ? 'State or territory' : 'State, province or region (optional)', maximum: 100, autoComplete: 'address-level1', required: country === 'US', hint: country === 'US' ? 'Two-letter code, such as CA or DC.' : undefined })}
        {field({ key: 'postalCode', label: country === 'US' ? 'ZIP code' : 'Postal code (if used)', maximum: 20, autoComplete: 'postal-code', inputMode: country === 'US' ? 'numeric' : undefined, required: country === 'US' })}
      </div>
    </> : null}
    {issues._form ? <p className="contact-field-error" role="alert">{issues._form}</p> : null}
  </div>
}
