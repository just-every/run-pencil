import { useState } from 'react'
import { audienceRequest, segmentsPath, type Rule, type Segment } from './audienceApi'
export function AudienceSegments({ segments, changed }: { segments: Segment[]; changed: () => Promise<void> }) {
  const [editing, setEditing] = useState<string>(), [name, setName] = useState('')
  const [rules, setRules] = useState<Rule[]>([{ field: 'emailDomain', operator: 'is', value: '' }])
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const act = async (operation: () => Promise<unknown>) => { setBusy(true); setError(undefined); setNotice(undefined); try { await operation(); await changed(); setNotice('Segments saved. Counts reflect current contacts.') } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  const reset = () => { setEditing(undefined); setName(''); setRules([{ field: 'emailDomain', operator: 'is', value: '' }]) }
  const patch = (index: number, change: Partial<Rule>) => setRules(rules.map((rule, i) => i === index ? { ...rule, ...change } : rule))
  return <section className="panel" style={{ padding: '1.25rem', minWidth: 0 }} aria-labelledby="segments-title">
    <h2 id="segments-title">Saved segments</h2>
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}{notice ? <p role="status" className="status-note">{notice}</p> : null}
    <ul>{segments.map(segment => <li key={segment.id} style={{ overflowWrap: 'anywhere' }}><strong>{segment.name}</strong> · {segment.matchCount} current matches{' '}
      <button className="quiet-button focus-ring" type="button" disabled={busy} aria-label={`Edit segment ${segment.name}`} onClick={() => { setEditing(segment.id); setName(segment.name); setRules(segment.rules) }}>Edit</button>{' '}
      <button className="quiet-button focus-ring" type="button" disabled={busy} aria-label={`Delete segment ${segment.name}`} onClick={() => { if (window.confirm('Delete this saved segment? Existing launches keep their frozen audience.')) void act(() => audienceRequest(`${segmentsPath}/${segment.id}`, {}, 'DELETE')) }}>Delete</button>
    </li>)}</ul>
    <form onSubmit={event => { event.preventDefault(); void act(async () => { await audienceRequest(editing ? `${segmentsPath}/${editing}` : segmentsPath, { name, rules: rules.map(rule => ({ field: rule.field, operator: rule.operator, ...(rule.field === 'custom' ? { key: rule.key } : {}), ...(rule.operator === 'is-set' ? {} : { value: rule.value }) })) }, editing ? 'PUT' : 'POST'); reset() }) }}>
      <fieldset style={{ minWidth: 0 }} disabled={busy}><legend>{editing ? 'Edit segment' : 'New segment'}</legend>
        <label className="inspector-field">Segment name<input className="text-input" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
        {rules.map((rule, index) => <fieldset key={index} style={{ minWidth: 0 }}><legend>Rule {index + 1}</legend>
          <label className="inspector-field">Rule {index + 1} field<select className="text-input" value={rule.field} onChange={e => patch(index, { field: e.target.value as Rule['field'], value: '', key: undefined, operator: 'is' })}><option value="name">Name</option><option value="emailDomain">Email domain</option><option value="consent">Consent</option><option value="custom">Custom field</option></select></label>
          {rule.field === 'custom' ? <label className="inspector-field">Rule {index + 1} custom key<input className="text-input" required maxLength={64} value={rule.key ?? ''} onChange={e => patch(index, { key: e.target.value })} /></label> : null}
          <label className="inspector-field">Rule {index + 1} comparison<select className="text-input" value={rule.operator} onChange={e => patch(index, { operator: e.target.value as Rule['operator'] })}><option value="is">is</option>{rule.field !== 'consent' ? <><option value="contains">contains</option><option value="is-set">is set</option></> : null}</select></label>
          {rule.operator !== 'is-set' ? rule.field === 'consent' ? <label className="inspector-field">Rule {index + 1} value<select className="text-input" required value={rule.value ?? ''} onChange={e => patch(index, { value: e.target.value })}><option value="">Choose consent state</option><option value="eligible">Eligible</option><option value="opted-out">Opted out</option></select></label> : <label className="inspector-field">Rule {index + 1} value<input className="text-input" required maxLength={500} value={rule.value ?? ''} onChange={e => patch(index, { value: e.target.value })} /></label> : null}
          <button className="quiet-button focus-ring" type="button" disabled={rules.length === 1} onClick={() => setRules(rules.filter((_, i) => i !== index))}>Remove rule {index + 1}</button>
        </fieldset>)}
        <button className="quiet-button focus-ring" type="button" disabled={rules.length >= 10} onClick={() => setRules([...rules, { field: 'name', operator: 'contains', value: '' }])}>Add segment rule</button>
      </fieldset>
      <button className="primary-button focus-ring" type="submit" disabled={busy}>Save segment</button>{' '}{editing ? <button className="quiet-button focus-ring" type="button" disabled={busy} onClick={reset}>Cancel segment edit</button> : null}
    </form>
  </section>
}
