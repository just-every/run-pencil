import { Fragment, useEffect, useState } from 'react'
import { searchRanges } from '../../../shared/searchFold'

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
  const ranges = searchRanges(text, search)
  let end = 0
  return <>{ranges.map(range => {
    const before = text.slice(end, range.start)
    end = range.end
    return <Fragment key={range.start}>{before}<mark>{text.slice(range.start, range.end)}</mark></Fragment>
  })}{text.slice(end)}</>
}
