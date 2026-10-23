import { consentPurposeLabels, type ConsentRecord } from '../../../shared/marketingConsent'

/** GOV-007: each response's consent per purpose, with the wording shown and when. Shown on the response only; never part of an export. */
export function ConsentRecords({ records, time }: { records?: ConsentRecord[]; time: (value: string) => string }) {
  if (!records?.length) return null
  return <section aria-label="Consent records"><p className="eyebrow">Consent</p><dl>{records.map(record => <div className="ledger-answer" key={`${record.purpose}-${record.source}`}>
    <dt><strong>{consentPurposeLabels[record.purpose]}</strong></dt>
    <dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{record.given ? 'Consent given' : 'Consent not given'} · {time(record.at)}<br />“{record.wording}”{record.source === 'form' ? ' (form opt-in)' : ''}</dd>
  </div>)}</dl></section>
}
