import { Fragment, useEffect, useState } from 'react'

export function LedgerSearch({ value, onSearch }: { value?: string; onSearch: (value?: string) => void }) {
  const [query, setQuery] = useState(value ?? '')
  useEffect(() => setQuery(value ?? ''), [value])
  return <form className="ledger-search" role="search" aria-label="Search responses" onSubmit={event => { event.preventDefault(); onSearch(query.trim() || undefined) }}>
    <label className="inspector-field">Search responses<input className="text-input" type="search" maxLength={200} placeholder="Answer text, choice or participant" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <button className="secondary-button focus-ring" type="submit">Search</button>
    {value ? <button className="quiet-button focus-ring" type="button" onClick={() => { setQuery(''); onSearch(undefined) }}>Clear search</button> : null}
  </form>
}

export function SearchHighlight({ text, search }: { text: string; search?: string }) {
  if (!search) return <>{text}</>
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return <>{parts.map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : <Fragment key={index}>{part}</Fragment>)}</>
}
